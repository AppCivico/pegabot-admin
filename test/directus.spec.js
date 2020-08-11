import 'dotenv/config';

import chai from 'chai';
import chaiFs from 'chai-fs';
import sinon from 'sinon';
import fs from 'fs';
import DirectusSDK from '@directus/sdk-js';
import axios from 'axios';
import directus from '../src/directus';
import mockFiles from './mock/files';
import mockItems from './mock/collectionItem';

chai.use(chaiFs);
const { expect } = chai;

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

describe('saveFilesToDisk', () => {
  const pathLoadFiles = `${process.env.NODE_PATH}/test/mock/filesToDownload`;
  const pathSaveFiles = `${process.env.NODE_PATH}/test/mock/whereToSave`;

  beforeEach(() => {
    sinon.stub(axios, 'get').callsFake((fileName) => ({ data: fs.readFileSync(`${pathLoadFiles}/${fileName}`) }));
  });

  afterEach(() => {
    axios.get.restore();
  });

  it('Save CSV on folder, add ID to filename, have proper content', async () => {
    const fileToUse = mockFiles[0];

    await directus.saveFilesToDisk([fileToUse], pathSaveFiles);
    const expectedFilename = `${fileToUse.itemID}_${fileToUse.filename_download}`;
    const expectedData = await fs.readFileSync(`${pathLoadFiles}/${fileToUse.data.full_url}`);

    expect(axios.get.calledOnce).to.be.true;
    expect(`${pathSaveFiles}/${expectedFilename}`).to.be.a.file().with.content(expectedData.toString());
    await fs.unlinkSync(`${pathSaveFiles}/${expectedFilename}`);
  });

  it('Zip file, add ID to filename, ignore invalid files', async () => {
    const fileToUse = mockFiles[4];

    await directus.saveFilesToDisk([fileToUse], pathSaveFiles);
    const expectedFilename = `${fileToUse.itemID}_teste.csv`; // _teste.csv is the file inside of the zip

    expect(axios.get.calledOnce).to.be.true;
    expect(`${pathSaveFiles}/${expectedFilename}`).to.be.a.file().with.contents.that.match(/perfil/);
    expect(`${pathSaveFiles}/${expectedFilename}`).to.be.a.file().with.contents.that.match(/twitter/);
    await fs.unlinkSync(`${pathSaveFiles}/${expectedFilename}`);
    expect(pathSaveFiles).to.be.a.directory().and.empty; // should only have the one file we just deleted
  });

  it('Ignore files that arent csv or zip', async () => {
    const fileToUse = [mockFiles[1], mockFiles[2]];

    await directus.saveFilesToDisk(fileToUse, pathSaveFiles);
    expect(axios.get.called).to.be.false;
    expect(pathSaveFiles).to.be.a.directory().and.empty;
  });
});
