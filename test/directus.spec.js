import 'dotenv/config';

import chai from 'chai';
import chaiFs from 'chai-fs';
import sinon from 'sinon';
import fs from 'fs';
import DirectusSDK from '@directus/sdk-js';
import axios from 'axios';
import directus from '../src/directus';
import mailer from '../src/mailer';
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
  let expectedError = '';

  beforeEach(() => {
    sinon.stub(DirectusSDK.prototype, 'login').callsFake();
    sinon.stub(axios, 'get').callsFake((fileName) => ({ data: fs.readFileSync(`${pathLoadFiles}/${fileName}`) }));
    sinon.stub(DirectusSDK.prototype, 'updateItem').callsFake((cName, itemID, params) => {
      expect(params).to.be.a('object');
      expect(params.status).to.equal('error');
      expect(params.error).to.be.a('string');
      expect(params.error).to.equal(expectedError);

      return null;
    });
  });

  afterEach(async () => {
    axios.get.restore();
    DirectusSDK.prototype.updateItem.restore();
    DirectusSDK.prototype.login.restore();
    expectedError = '';
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

  it('Save item error for files that arent csv or zip', async () => {
    const fileToUse = [mockFiles[1], mockFiles[2]];
    expectedError = 'A extensão do arquivo adicionado não é válida, adicione apenas .csv ou um .zip com um .csv dentro.';

    await directus.saveFilesToDisk(fileToUse, pathSaveFiles);
    expect(axios.get.called).to.be.false;
    expect(pathSaveFiles).to.be.a.directory().and.empty;
    expect(DirectusSDK.prototype.updateItem.callCount).to.equal(fileToUse.length);
  });

  it('Save item error for zip that doesnt contain valid file', async () => {
    const fileToUse = [mockFiles[3]];
    expectedError = 'Não foi encontrado nenhum arquivo .csv dentro do .zip adicionado.';

    await directus.saveFilesToDisk(fileToUse, pathSaveFiles);
    expect(axios.get.called).to.be.true;
    expect(pathSaveFiles).to.be.a.directory().and.empty;
    expect(DirectusSDK.prototype.updateItem.callCount).to.equal(fileToUse.length);
  });
});

describe('sendMail', () => {
  const fileLink = '/myfile.zip';

  beforeEach(() => {
    sinon.stub(DirectusSDK.prototype, 'login').callsFake();
    sinon.stub(DirectusSDK.prototype, 'createItem').callsFake(() => ({ data: 'foobar' }));
    sinon.stub(mailer, 'sendEmail').callsFake((email) => (email.includes('2') ? { error: 'foobar' } : {}));
  });

  afterEach(() => {
    DirectusSDK.prototype.login.restore();
    DirectusSDK.prototype.createItem.restore();
    mailer.sendEmail.restore();
  });

  it('Mail sent with formated text and log added', async () => {
    const itemToUse = mockItems[0];

    const expectedMail = itemToUse.email;
    const expectedSubject = mailer.mailText.results.subject;
    let expectedBody = mailer.mailText.results.body;
    expectedBody = expectedBody.replace('<FILE_LINK>', process.env.DIRECTUS_HOST + fileLink);

    const res = await directus.sendMail(itemToUse, fileLink);

    expect(mailer.sendEmail.calledOnceWith(expectedMail, expectedSubject, expectedBody)).to.be.true;
    expect(DirectusSDK.prototype.createItem.calledOnce).to.be.true;
    expect(res).to.be.true;
  });

  it('Mail had an error but log is saved anyway', async () => {
    const itemToUse = mockItems[1];

    const expectedMail = itemToUse.email;
    const expectedSubject = mailer.mailText.results.subject;
    let expectedBody = mailer.mailText.results.body;
    expectedBody = expectedBody.replace('<FILE_LINK>', process.env.DIRECTUS_HOST + fileLink);

    const res = await directus.sendMail(itemToUse, fileLink);

    expect(mailer.sendEmail.calledOnceWith(expectedMail, expectedSubject, expectedBody)).to.be.true;
    expect(DirectusSDK.prototype.createItem.calledOnce).to.be.true;
    expect(res).to.be.true;
  });
});

describe('saveFileToDirectus', () => {
  let fileName = '';
  let itemID = '';
  let errors = [];
  const pathLoadFiles = `${process.env.NODE_PATH}/test/mock/whereToLoad`;

  beforeEach(() => {
    sinon.stub(DirectusSDK.prototype, 'login').callsFake();
    sinon.stub(DirectusSDK.prototype, 'uploadFiles').callsFake((fileData) => {
      const expectedName = fileName.replace('csv', 'zip');
      expect(fileData).to.be.a('object');
      expect(fileData.title).to.equal(expectedName);
      expect(fileData.filename_disk).to.equal(expectedName);
      expect(fileData.filename_download).to.equal(expectedName);
      expect(fileData.data).to.not.be.empty;

      return { data: { id: itemID } };
    });
    sinon.stub(DirectusSDK.prototype, 'updateItem').callsFake((cName, expectedItemID, itemData) => {
      expect(cName).to.not.be.empty;
      expect(expectedItemID).to.equal(itemID);
      expect(itemData).to.be.a('object');
      expect(itemData.status).to.equal('complete');
      expect(itemData.output_file).to.equal(expectedItemID);
      expect(itemData.analysis_date).to.be.a('string');
      expect(itemData.error).to.be.a('string');
      expect(itemData.error.trim()).to.equal('Linha: 3 - Usuário não existe');

      return { data: { id: expectedItemID } };
    });
  });

  afterEach(() => {
    DirectusSDK.prototype.login.restore();
    DirectusSDK.prototype.updateItem.restore();
    errors = [];
  });

  it('Save errors, turn csv to zip and return uploaded item from directus', async () => {
    fileName = '1_result.csv';
    itemID = fileName.substr(0, fileName.indexOf('_'));
    const newError = { line: 1, msg: 'Usuário não existe' };
    errors.push(newError);

    const res = await directus.saveFileToDirectus(fileName, errors, pathLoadFiles);
    expect(res).to.be.a('object');
    expect(res.data.id).to.equal(itemID);
  });
});
