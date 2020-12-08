import Queue from 'bull';
import Debug from 'debug';
import Directus from 'src/directus';
import { userRequestsCollection } from 'src/collections';

const debug = Debug('pegabot-admin:app');

(async () => {
  // TODO Use the env
  const queue = new Queue('default', { redis: { port: 6379, host: '127.0.0.1' } });

  const directus = await Directus();

  const pendingFiles = async () => {
    // Get directus client
    const items = await directus.getItems(userRequestsCollection, { filter: { status: { eq: 'waiting' } } });
    if (!items || !items.data || items.data.length === 0) {
      debug('There is no files with status "waiting"');
      return [];
    }

    const { data: fileList } = await directus.getFiles({ limit: -1 });

    const files = [];
    items.data.forEach((item) => {
      const file = fileList.find((upload) => upload.id === item.input_file);
      if (file) {
        file.itemId = item.id;
        files.push(file);
      }
    });
    return files;
  };

  const listenQueue = async (job, done) => {
    debug('Check if there are files pending...');
    const files = await pendingFiles();
    debug(files);

    done();
  };

  queue.add();

  queue.process(listenQueue);
  debug('Listening queue...');
})().catch((err) => {
  // TODO Handle this exception properly
  console.log(err);
});
// queue.add({}, { repeat: { cron: '* * * * *' } });



// import { queues } from './queues';
// import { processorInitialisers } from './processors';
// import { db } from './db';

// Object.entries(queues).forEach(([queueName, queue]) => {
//   console.log(`Worker listening to '${queueName}' queue`);
//   queue.process(processorInitialisers[queueName](db));
// });
