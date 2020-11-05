import 'dotenv/config';
import { CronJob } from 'cron';
import app from './app';
import redis from './redis';

const shouldStart = process.env.NODE_ENV !== 'dev';

const Cron = new CronJob(
  ' 00 0-59/1 * * * *', async () => {
    console.log('Running análise');
    try {
      const currentProcessing = await redis.get('current_processing');
      if (typeof currentProcessing === 'undefined') await redis.set('current_processing', 0);
      
      console.log('current_processing: ' + currentProcessing);
      if (currentProcessing == 0) {
        console.log(await app.procedure());
      }
    } catch (error) {
      console.log(error);
    }
  }, (() => { console.log('Crontab análise stopped.'); }),
  false, 'America/Sao_Paulo', false, shouldStart,
);

if (process.env.NODE_ENV !== 'dev') Cron.start();
console.log(`Crontab análiseCron is running? => ${Cron.running}`);
