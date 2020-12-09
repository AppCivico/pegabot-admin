import 'dotenv/config';
import { CronJob } from 'cron';
import fs from 'fs';
import app from './app';
import redis from './redis';

require('console-stamp')(console, '[HH:MM:ss.l]');

const logPath = '/home/node/app_pegabots_admin/log/';
if (fs.existsSync(logPath)) {
  const access = fs.createWriteStream(`${logPath}/app.log`, { flags: 'a' });
  process.stdout.write = process.stderr.write = access.write.bind(access);
}

process.on('uncaughtException', (err) => {
  console.error((err && err.stack) ? err.stack : err);
});

(async () => {
  const shouldStart = process.env.NODE_ENV !== 'dev';

  // Set current_processing to 0 on init
  await redis.set('current_processing', 0);

  // Timer to process the job queue
  const Cron = new CronJob(
    ' 00 0-59/1 * * * *', async () => {
      try {
        const currentProcessing = await redis.get('current_processing');
        if (typeof currentProcessing === 'undefined') await redis.set('current_processing', 0);

        console.log('current_processing: ' + currentProcessing);
        if (Number(currentProcessing) === 0) {
          await app.procedure();
        }
      } catch (error) {
        console.log(error);
      }
    }, (() => { console.log('Crontab análise stopped.'); }),
    false, 'America/Sao_Paulo', false, shouldStart,
  );

  if (process.env.NODE_ENV !== 'dev') Cron.start();
  console.log(`Crontab análiseCron is running? => ${Cron.running}`);
})();
