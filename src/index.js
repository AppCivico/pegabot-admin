import 'dotenv/config';
import { CronJob } from 'cron';
import app from './app';

const Cron = new CronJob(
  ' 00 0-59/1 * * * *', async () => {
    console.log('Running notificacao');
    try {
      console.log(await app.procedure());
    } catch (error) {
      console.log(error);
    }
  }, (() => { console.log('Crontab notificacao stopped.'); }),
  false, 'America/Sao_Paulo', false, true,
);

Cron.start();
console.log(`Crontab notificacaoCron is running? => ${Cron.running}`);
