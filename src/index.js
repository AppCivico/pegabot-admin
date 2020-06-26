import 'dotenv/config';
import { CronJob } from 'cron';
import procedure from './app';
import directus from './directus';

const Cron = new CronJob(
  ' 00 0-59/5 * * * *', async () => {
    console.log('Running notificacao');
    try {
      console.log(await procedure());
    } catch (error) {
      console.log(error);
    }
  }, (() => { console.log('Crontab notificacao stopped.'); }),
  false, 'America/Sao_Paulo', false, false,
);

// Cron.start();
// console.log(`Crontab notificacaoCron is running? => ${Cron.running}`);
