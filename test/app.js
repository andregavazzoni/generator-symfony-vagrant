'use strict';
var path = require('path');
var helpers = require('yeoman-generator').test;

describe('generator-symfony-vagrant:app', function () {
  before(function (done) {
    helpers.run(path.join(__dirname, '../generators/app'))
    .withPrompts({
      appName: 'test',
      hostname: 'test.local',
      privateIp: '10.10.10.10',
      provision: false,
      editHosts: false
    })
    .on('end', done);
  });
});
