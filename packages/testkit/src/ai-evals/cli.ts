import {readFile} from 'node:fs/promises';
import {dryRun,validateResults} from './runner.ts';
const args=process.argv.slice(2);
if(args.length===0||(args.length===1&&args[0]==='--dry-run'))process.stdout.write(`${JSON.stringify(dryRun(),null,2)}\n`);
else if(args.length===2&&args[0]==='--validate-results'){
 try{const result=validateResults(JSON.parse(await readFile(args[1]!,'utf8')) as unknown);process.stdout.write(`${JSON.stringify(result,null,2)}\n`);if(result.status!=='PASS')process.exitCode=2;}
 catch{process.stderr.write('Invalid evaluation artifact. No requests were sent.\n');process.exitCode=2;}
}else{process.stderr.write('Usage: cli.ts [--dry-run | --validate-results <synthetic-capture.json>]\nNo live-provider execution is implemented or enabled.\n');process.exitCode=2;}
