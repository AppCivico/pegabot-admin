import 'dotenv/config';

import { expect } from 'chai';
import sinon from 'sinon';
import DirectusSDK from '@directus/sdk-js';
import directus from '../src/directus';
import mockFiles from './mock/files';
import mockItems from './mock/collectionItem';

describe('getOneFile', () => {
  beforeEach(() => {
    sinon.stub(DirectusSDK.prototype, 'login').callsFake();
    sinon.stub(DirectusSDK.prototype, 'getFiles').returns({ data: mockFiles });
  });

  afterEach(() => {
    DirectusSDK.prototype.login.restore();
    DirectusSDK.prototype.getFiles.restore();
  });

  it('ID found -> return file', async () => {
    const fileID = 1;
    const res = await directus.getOneFile(fileID);
    expect(res).to.be.a('object');
    expect(res.id).to.equal(fileID);
  });

  it('ID not found -> return undefined', async () => {
    const fileID = 500;
    const res = await directus.getOneFile(fileID);
    expect(res).to.equal(undefined);
  });
});

describe('getFileItem', () => {
  beforeEach(() => {
    sinon.stub(DirectusSDK.prototype, 'login').callsFake();
    sinon.stub(DirectusSDK.prototype, 'getItem').callsFake((cName, itemID) => {
      const data = mockItems.find((x) => x.id.toString() === itemID);
      return { data };
    });
  });

  afterEach(() => {
    DirectusSDK.prototype.login.restore();
    DirectusSDK.prototype.getItem.restore();
  });

  it('Valid File ID found -> return file data', async () => {
    const fileName = '1_myFile.csv';
    const res = await directus.getFileItem(fileName);
    expect(res).to.be.a('object');
    expect(res.id).to.equal(1);
  });

  it('Invalid File ID found -> return empty object', async () => {
    const fileName = '500_myFile.csv';
    const res = await directus.getFileItem(fileName);
    expect(res).to.be.a('object');
    expect(res).to.be.empty;
  });

  it('File ID not found -> return empty object', async () => {
    const fileName = 'myfile.csv';

    const res = await directus.getFileItem(fileName);
    expect(res).to.be.a('object');
    expect(res).to.be.empty;
  });
});

describe('updateFileStatus', () => {
  beforeEach(() => {
    sinon.stub(DirectusSDK.prototype, 'login').callsFake();
    sinon.stub(DirectusSDK.prototype, 'getItem').callsFake((cName, itemID) => {
      const data = mockItems.find((x) => x.id.toString() === itemID);
      return { data };
    });
  });

  afterEach(() => {
    DirectusSDK.prototype.login.restore();
    DirectusSDK.prototype.getItem.restore();
  });

  it('Valid File ID found -> return file data', async () => {
    const fileName = '1_myFile.csv';
    const res = await directus.getFileItem(fileName);
    expect(res).to.be.a('object');
    expect(res.id).to.equal(1);
  });

  it('Invalid File ID found -> return empty object', async () => {
    const fileName = '500_myFile.csv';
    const res = await directus.getFileItem(fileName);
    expect(res).to.be.a('object');
    expect(res).to.be.empty;
  });

  it('File ID not found -> return empty object', async () => {
    const fileName = 'myfile.csv';

    const res = await directus.getFileItem(fileName);
    expect(res).to.be.a('object');
    expect(res).to.be.empty;
  });
});

describe('getFilesToProcess', () => {
  let itemsToUse = [];

  beforeEach(() => {
    sinon.stub(DirectusSDK.prototype, 'login').callsFake();
    sinon.stub(DirectusSDK.prototype, 'getFiles').returns({ data: mockFiles });
    sinon.stub(DirectusSDK.prototype, 'getItems').callsFake((cName, { filter }) => {
      const status = filter.status.eq;
      const data = itemsToUse.filter((x) => x.status === status);
      return { data };
    });
  });

  afterEach(() => {
    DirectusSDK.prototype.login.restore();
    DirectusSDK.prototype.getFiles.restore();
    DirectusSDK.prototype.getItems.restore();
  });

  it('Get waiting items and add file data', async () => {
    itemsToUse = mockItems;
    const res = await directus.getFilesToProcess();

    expect(res).to.be.a('array');
    expect(res[0].id).to.equal(1);
    expect(res[0].itemID).to.equal(1);
    expect(res[1].id).to.equal(6);
    expect(res[1].itemID).to.equal(6);
  });

  it('Get empty array if theres no item with waiting status', async () => {
    itemsToUse[0].status = 'complete';
    itemsToUse[5].status = 'complete';

    const res = await directus.getFilesToProcess();
    expect(res).to.be.a('array');
    expect(res).to.empty;
  });

  it('Get empty array if theres no item with waiting status and a file', async () => {
    itemsToUse[2].status = 'waiting';

    const res = await directus.getFilesToProcess();
    expect(res).to.be.a('array');
    expect(res).to.empty;
  });
});
