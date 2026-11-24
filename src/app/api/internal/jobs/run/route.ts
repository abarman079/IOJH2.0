import { handleRunnerRequest, methodDenied } from '@/lib/jobs/runner-policy.mjs';
import { runJobs } from '@/lib/jobs/runner';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=40;
export async function POST(request:Request){return handleRunnerRequest(request,process.env,runJobs);}
export const GET=methodDenied;export const HEAD=methodDenied;export const PUT=methodDenied;export const PATCH=methodDenied;export const DELETE=methodDenied;export const OPTIONS=methodDenied;
