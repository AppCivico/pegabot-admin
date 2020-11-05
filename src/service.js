import minimist from 'minimist';
import getDirectusClient from './DirectusSDK';

const userRequestsCollection = 'user_requests';
const validStatuses = ['error', 'waiting', 'analysing', 'complete'];

const args = minimist(process.argv.slice(2));

async function updateState(itemID, newStatus) {
  const client = await getDirectusClient();

  const updatedItem = await client.updateItem(userRequestsCollection, itemID, { status: newStatus }).catch((e) => e);
  if (updatedItem && updatedItem.data && updatedItem.data.id) return `Item ${itemID} atualizado com sucesso!`;

  return `Houve um erro ao atualizar o item ${itemID}: ${updatedItem}`;
}

async function main() {
  if (args.updateState) {
    if (typeof args.updateState !== 'number') return 'updateState precisa receber um número de id do item';
    if (!validStatuses.includes(args.state)) return `state precisa ser uma das opções: ${validStatuses.join('|')}`;

    return updateState(args.updateState, args.state);
  }

  return 'Examplo: --updateState 1 --state error';
}

(async () => {
  const res = await main();
  console.log(res);
})();
