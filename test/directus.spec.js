import 'dotenv/config';

import { expect } from 'chai';
import sinon from 'sinon';
import DirectusSDK from '@directus/sdk-js';
import directus from '../src/directus';
import mockFiles from './mock/files';

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
    const myFile = await directus.getOneFile(fileID);
    await expect(myFile).to.be.a('object');
    await expect(myFile.id).to.equal(fileID);
  });

  it('ID not found -> return undefined', async () => {
    const fileID = 500;
    const myFile = await directus.getOneFile(fileID);
    await expect(myFile).to.equal(undefined);
  });
});
