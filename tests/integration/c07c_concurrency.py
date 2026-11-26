"""Disposable local Supabase only, no external delivery. Independent PostgreSQL sessions."""
import os, uuid, threading
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse
import psycopg
DSN=os.environ.get('IOJH_TEST_DATABASE_URL','')
u=urlparse(DSN)
if u.hostname!='127.0.0.1' or u.port!=54322 or u.path!='/postgres':
    raise SystemExit('Refusing non-disposable local database')
def db():
    return psycopg.connect(DSN,connect_timeout=5,options='-c statement_timeout=10000')
def one(sql,args=()):
    with db() as c:
        return c.execute(sql,args).fetchone()[0]
def claim(run, email=False, recipient=None, notification=None):
    with db() as c:
        return [r[0] for r in c.execute('select * from public.iojh_runner_claim(%s,%s,%s,%s,%s)',(run,'c07c-concurrency',email,recipient,notification)).fetchall()]
def lease(job):
    return (job['jobId'],job['leaseToken'],job['leaseGeneration'])
def race(fn):
    b=threading.Barrier(2)
    def run(i):
        b.wait(timeout=5);return fn(i)
    with ThreadPoolExecutor(max_workers=2) as pool:
        return list(pool.map(run,range(2)))
# Start clean disposable operational state; prior pgTAP rolled back. C07a leaves only future or terminal fixtures.
runs=race(lambda _:one('select public.iojh_runner_begin()'))
assert sum(x is not None for x in runs)==1,runs
run=next(x for x in runs if x is not None)
print('PASS: one invocation acquires durable run token')
jobid=one('select public.iojh_jobs_enqueue_probe(%s,%s,null,2)',(uuid.uuid4(),'c07c-parallel-'+uuid.uuid4().hex))
claims=race(lambda _:claim(run))
flat=[j for group in claims for j in group]
assert len(flat)==1 and flat[0]['jobId']==str(jobid),flat
old=flat[0]
print('PASS: separate claim sessions cannot double claim')
with db() as c:
    c.execute("update private.jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=%s",(jobid,))
    c.execute("update private.runner_state set run_until=clock_timestamp()-interval '1 second' where id=1")
newrun=one('select public.iojh_runner_begin()');assert newrun!=run
new=claim(newrun)[0];assert new['jobId']==str(jobid) and new['leaseGeneration']>old['leaseGeneration']
assert one('select public.iojh_jobs_complete(%s,%s,%s)',lease(old)) is False
assert one('select public.iojh_jobs_renew(%s,%s,%s,60)',lease(old)) is None
assert one('select public.iojh_jobs_fail(%s,%s,%s,\'timeout\',false)',lease(old))=='stale'
assert one('select public.iojh_jobs_complete(%s,%s,%s)',lease(new)) is True
print('PASS: crash takeover fences completion, renewal and failure')
assert one('select public.iojh_runner_end(%s,true,\'{}\'::jsonb)',(run,)) is False
assert one('select public.iojh_runner_cooldown(%s,300)',(newrun,)) is True
notice=one('select public.iojh_notifications_enqueue_fixture(%s,%s,\'en\')',('C07C-RACE-001','c07c-notice-'+uuid.uuid4().hex))
assert claim(newrun,True,'fixture@example.invalid',notice)==[]
print('PASS: cooldown retains email attempt budget')
with db() as c:c.execute("update private.runner_state set cooldown_until='-infinity' where id=1")
job=claim(newrun,True,'fixture@example.invalid',notice)[0]
assert one('select public.iojh_notifications_prepare(%s,%s,%s)',lease(job))['action']=='send'
assert one('select public.iojh_runner_authorize_send(%s,%s,%s,%s,%s)',(newrun,*lease(job),'a'*64))=='send'
provider=str(uuid.uuid4())
# Simulate provider acceptance concurrently with signed-event ingestion, not a real provider send.
res=race(lambda i:one('select public.iojh_notifications_finish(%s,%s,%s,\'accepted\',%s,null)',(*lease(job),provider)) if i==0 else one('select public.iojh_notifications_provider_event(%s,%s,\'email.delivered\')',('evt_'+uuid.uuid4().hex,provider)))
assert one('select status from private.notification_records where id=%s',(notice,))=='delivered',res
print('PASS: concurrent REST settlement and webhook converge')
assert one('select public.iojh_runner_end(%s,true,\'{}\'::jsonb)',(newrun,)) is True
