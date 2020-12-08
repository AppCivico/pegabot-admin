import Queue from 'bull';
import Debug from 'debug';
import directus from './directus';

const debug = Debug('pegabot-admin:app');

// TODO Use the env
const queue = new Queue('default', { redis: { port: 6379, host: '127.0.0.1' } });

const pendingFiles = async () => {
  // Get directus client
  const client = await directus();
  debug('%o', client);
};

const listenQueue = async (job, done) => {
  debug('Check if there are files pending...');
  const files = await pendingFiles();
  debug(files);

  done();
};

// queue.add({}, { repeat: { cron: '* * * * *' } });
queue.add();

queue.process(listenQueue);
debug('Listening queue...');

// import { queues } from './queues';
// import { processorInitialisers } from './processors';
// import { db } from './db';

// Object.entries(queues).forEach(([queueName, queue]) => {
//   console.log(`Worker listening to '${queueName}' queue`);
//   queue.process(processorInitialisers[queueName](db));
// });
