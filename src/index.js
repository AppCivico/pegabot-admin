import 'dotenv/config';
import { CronJob } from 'cron';
import app from './app';

const Cron = new CronJob(
  ' 00 0-59/1 * * * *', async () => {
    console.log('Running análise');
    try {
      console.log(await app.procedure());
    } catch (error) {
      console.log(error);
    }
  }, (() => { console.log('Crontab análise stopped.'); }),
  false, 'America/Sao_Paulo', false, true,
);

if (process.env.NODE_ENV !== 'dev') Cron.start();
console.log(`Crontab análiseCron is running? => ${Cron.running}`);
