"""C07a concurrency test: disposable local Supabase on 127.0.0.1:54322 ONLY.

Runs with two real PostgreSQL sessions; NO hosted endpoint or Supabase credential.
Requires pip install psycopg[binary]==3.2.10 in Linux CI.
"""
from __future__ import annotations
import os
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse
import psycopg

DSN = os.environ.get('IOJH_TEST_DATABASE_URL', 'postgresql://postgres:postgres@127.0.0.1:54322/postgres')
u = urlparse(DSN)
if u.hostname not in ('127.0.0.1', 'localhost', '::1') or u.port != 54322 or u.path != '/postgres':
    raise SystemExit('REFUSING: C07a destructive fixtures require disposable LOCAL port 54322 database')


def db():
    return psycopg.connect(DSN, connect_timeout=5)


def enqueue(prefix: str, max_attempts: int = 3, due: str = 'now'):
    correlation = str(uuid.uuid4())
    with db() as con:
        with con.cursor() as cur:
            cur.execute('select public.iojh_jobs_enqueue_probe(%s,%s,clock_timestamp(),%s)',
                        (correlation, prefix + uuid.uuid4().hex, max_attempts))
            return cur.fetchone()[0]


def claim(worker: str, hold: float = 0):
    with db() as con:
        with con.cursor() as cur:
            cur.execute('select claimed from public.iojh_jobs_claim(%s,1,15) as t(claimed)', (worker,))
            rows = cur.fetchall()
            if hold:
                time.sleep(hold)
        return rows[0][0] if rows else None



def test_expired_lease_after_lock_wait(prefix: str, operation: str):
    """Regression: a lease must be checked at DB time AFTER the job row lock.

    Simulates a real contended PostgreSQL row with three separate connections.
    The lock is held across expiry. Original C07a would wrongly accept stale work.
    """
    job_id = enqueue(prefix)
    lease = claim('c07-blocked-' + operation)
    assert lease is not None and lease['jobId'] == str(job_id)
    blocker = db()
    started = threading.Event()
    worker_pid = []
    try:
        # Changing expiry while holding the row lock makes the RPC wait. Commit
        # only AFTER expiry. No sleep inside the RPC; this is a real lock wait.
        blocker.execute("update private.jobs set lease_expires_at = clock_timestamp() + interval '4 seconds' where id=%s", (job_id,))
        lock_start = time.monotonic()

        def blocked_rpc():
            with db() as con:
                con.execute("set statement_timeout = '12000ms'")
                pid = con.execute('select pg_backend_pid()').fetchone()[0]
                worker_pid.append(pid)
                started.set()
                args = (lease['jobId'], lease['leaseToken'], lease['leaseGeneration'])
                if operation == 'complete':
                    return con.execute('select public.iojh_jobs_complete(%s,%s,%s)', args).fetchone()[0]
                if operation == 'renew':
                    return con.execute('select public.iojh_jobs_renew(%s,%s,%s,60)', args).fetchone()[0]
                return con.execute("select public.iojh_jobs_fail(%s,%s,%s,'timeout',false)", args).fetchone()[0]

        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(blocked_rpc)
            assert started.wait(5), 'worker did not start'
            blocked = False
            while time.monotonic() - lock_start < 2.5:
                with db() as monitor:
                    wait_event = monitor.execute(
                        'select wait_event_type from pg_stat_activity where pid=%s',
                        (worker_pid[0],)
                    ).fetchone()
                if wait_event and wait_event[0] == 'Lock':
                    blocked = True
                    break
                if future.done():
                    break
                time.sleep(0.05)
            assert blocked, f'{operation} RPC did not block on a PostgreSQL row lock before expiry'
            assert time.monotonic() - lock_start < 3.5, 'worker did not block before expiry'
            time.sleep(max(0, 4.3 - (time.monotonic() - lock_start)))
            blocker.commit()
            result = future.result(timeout=10)
        expected = {'complete': False, 'renew': None, 'fail': 'stale'}[operation]
        assert result == expected, f'{operation} accepted an expired lease after a lock wait: {result!r}'
        print(f'PASS: {operation} rejects a lease expired while waiting on a database lock')
    finally:
        blocker.rollback()
        blocker.close()

def main():
    prefix = 'c07_parallel_' + uuid.uuid4().hex[:8] + '_'
    # Two transactions race for ONE dedupe key. Both must return the identical job.
    key = prefix + 'same_event'
    correlation = str(uuid.uuid4())
    barrier = threading.Barrier(2)
    def duplicate_enqueue(_worker):
        with db() as con:
            with con.cursor() as cur:
                barrier.wait(timeout=5)
                cur.execute('select public.iojh_jobs_enqueue_probe(%s,%s,clock_timestamp()+interval \'1 hour\',3)', (correlation,key))
                return cur.fetchone()[0]
    with ThreadPoolExecutor(max_workers=2) as pool:
        a,b = list(pool.map(duplicate_enqueue,[1,2]))
    assert a == b, 'concurrent duplicate enqueue produced two jobs'
    print('PASS: concurrent enqueue deduplicated one logical obligation')

    job_id = enqueue(prefix)
    barrier = threading.Barrier(2)
    def race(worker):
        with db() as con:
            with con.cursor() as cur:
                barrier.wait(timeout=5)
                cur.execute('select claimed from public.iojh_jobs_claim(%s,1,15) as t(claimed)', (worker,))
                rows = cur.fetchall()
                time.sleep(.3) # Keep the selected row locked while competitor claims.
                return rows[0][0] if rows else None
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(race,['c07-racer-01','c07-racer-02']))
    winners = [r for r in results if r is not None]
    assert len(winners) == 1 and winners[0]['jobId'] == str(job_id), f'double claim or missing job: {results}'
    old = winners[0]
    print('PASS: competing sessions cannot acquire the same due job')

    # Force lease timeout in the DISPOSABLE test DB; a new lease invalidates old worker.
    with db() as con:
        con.execute("update private.jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=%s", (job_id,))
    new = claim('c07-takeover-01')
    assert new is not None and new['jobId'] == str(job_id)
    assert new['leaseToken'] != old['leaseToken'] and new['leaseGeneration'] > old['leaseGeneration']
    with db() as con:
        assert con.execute('select public.iojh_jobs_complete(%s,%s,%s)',
            (old['jobId'],old['leaseToken'],old['leaseGeneration'])).fetchone()[0] is False
        assert con.execute('select public.iojh_jobs_fail(%s,%s,%s,%s,false)',
            (old['jobId'],old['leaseToken'],old['leaseGeneration'],'late_worker')).fetchone()[0] == 'stale'
        assert con.execute('select public.iojh_jobs_complete(%s,%s,%s)',
            (new['jobId'],new['leaseToken'],new['leaseGeneration'])).fetchone()[0] is True
    print('PASS: lease takeover rejects stale completion and stale failure')

    # A worker crash BEFORE its claim transaction commits leaves the row claimable.
    rollback_id = enqueue(prefix)
    con = db()
    try:
        con.execute('select claimed from public.iojh_jobs_claim(%s,1,15) as t(claimed)',('c07-rollback-01',)).fetchone()
        con.rollback()
    finally:
        con.close()
    recovered = claim('c07-after-rollback')
    assert recovered is not None and recovered['jobId']==str(rollback_id), 'rolled-back claim hid job'
    with db() as con:
        assert con.execute('select public.iojh_jobs_complete(%s,%s,%s)',
            (recovered['jobId'],recovered['leaseToken'],recovered['leaseGeneration'])).fetchone()[0] is True
    print('PASS: aborted claim transaction does not lose a job')
    for operation in ('complete', 'renew', 'fail'):
        test_expired_lease_after_lock_wait(prefix, operation)
    print('C07a separate-session concurrency: 7 scenarios passed in disposable local database')

if __name__ == '__main__':
    main()
