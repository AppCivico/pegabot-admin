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
    sinon.stub(DirectusSDK.prototype, 'getItem').callsFake((collectionName, itemID) => mockItems.find((x) => x.data.id.toString() === itemID));
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
    sinon.stub(DirectusSDK.prototype, 'getItem').callsFake((collectionName, itemID) => mockItems.find((x) => x.data.id.toString() === itemID));
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
