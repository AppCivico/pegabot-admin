import 'dotenv/config';

import chai from 'chai';
import help from '../src/helper';

const { expect } = chai;

describe('getFileContent', () => {
  it('csv - return array with objects containing profiles to analyse', async () => {
    const filePath = `${process.env.NODE_PATH}/test/mock/filesToDownload/arquivo1.csv`;

    const res = await help.getFileContent(filePath);
    expect(res).to.be.a('array');
    expect(res[0]).to.be.a('object');
    expect(res[0].perfil).to.equal('twitter');
  });

  it('xls - same and join the profiles from the different sheets', async () => {
    const filePath = `${process.env.NODE_PATH}/test/mock/filesToDownload/arquivo8.xls`;

    const res = await help.getFileContent(filePath);
    expect(res).to.be.a('array');
    expect(res[0]).to.be.a('object');
    expect(res[0].perfil).to.equal('appcivico');
    expect(res[1]).to.be.a('object');
    expect(res[1].perfil).to.equal('twitter');
  });

  it('xlsx - same and join the profiles from the different sheets', async () => {
    const filePath = `${process.env.NODE_PATH}/test/mock/filesToDownload/arquivo9.xlsx`;

    const res = await help.getFileContent(filePath);
    expect(res).to.be.a('array');
    expect(res[0]).to.be.a('object');
    expect(res[0].perfil).to.equal('appcivico');
    expect(res[1]).to.be.a('object');
    expect(res[1].perfil).to.equal('twitter');
  });

  it('Unsupported file - returns null', async () => {
    const filePath = `${process.env.NODE_PATH}/test/mock/filesToDownload/arquivo2.txt`;

    const res = await help.getFileContent(filePath);
    expect(res).to.equal(null);
  });
});

describe('checkInvalidFiles', () => {
  const tests = [
    { name: 'empty filename', fileName: '', expected: true },
    { name: 'null filename', fileName: null, expected: true },
    { name: 'number filename', fileName: 12345, expected: true },
    { name: 'object filename', fileName: {}, expected: true },
    { name: '__MACOSX folder', fileName: '__MACOSX/', expected: true },
    { name: '__MACOSX csv', fileName: '__MACOSX.csv', expected: true },
    { name: '._ filename', fileName: '._teste.csv', expected: true },
    { name: 'No extension', fileName: 'teste', expected: true },
    { name: 'invalid extension txt', fileName: 'test.txt', expected: true },
    { name: 'invalid extension zip', fileName: 'test.zip', expected: true },
    { name: 'csv', fileName: 'test.csv', expected: false },
    { name: 'xls', fileName: 'test.xls', expected: false },
    { name: 'xlsx', fileName: 'test.xlsx', expected: false },
  ];

  tests.forEach((e) => {
    it(`${e.name} - ${e.expected}`, () => {
      const res = help.checkInvalidFiles(e.fileName);
      expect(res).to.be.a('boolean');
      expect(res).to.equal(e.expected);
    });
  });
});
