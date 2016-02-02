'use strict';
var yeoman = require('yeoman-generator');
var chalk = require('chalk');
var yosay = require('yosay');
var replace = require('replace');

module.exports = yeoman.generators.Base.extend({
  initializing: function() {
    this.spawnCommand('vagrant', ['destroy', '--force']);
  },

  prompting: function () {
    var done = this.async();

    // Have Yeoman greet the user.
    this.log(yosay(
      'Welcome to the' + chalk.red('Symfony-Vagrant') + ' generator!'
    ));

    var prompts = [{
      type: 'input',
      name: 'appName',
      message: 'First, we need to know your ' + chalk.yellow('app name') + ':',
      default: this.appname
    }, {
      type: 'input',
      name: 'hostname',
      message: 'And know a ' + chalk.yellow('hostname') + ' (Keep it simple):',
      default: this.appname + ".local"
    }, { 
      type: 'input',
      name: 'privateIp',
      message: 'Choose a nice ' + chalk.yellow('Private IP Address') + ' for your VM:',
      default: "192.168.100.10"
    }, {
      type: 'confirm',
      name: 'provision',
      message: 'Last, tell us if you want to use our ' + chalk.yellow('Puppet Provisioning') + ':',
      default: true
    }];

    this.prompt(prompts, function (props) {
      this.props = props;
      done();
    }.bind(this));
  },

  writing: {
    vagrant: function() {
      this.mkdir(this.props.appName);

      this.fs.copyTpl(
        this.templatePath('Vagrantfile'),
        this.destinationPath('Vagrantfile'), {
          appName: this.props.appName,
          hostname: this.props.hostname,
          privateIp: this.props.privateIp,
          provision: this.props.provision
        }
      );
    },

    puppet: function() {
      var puppetDir = 'puppet/environments/devel/';

      this.mkdir(puppetDir + 'vendor');

      this.fs.copy(
        this.templatePath(puppetDir + 'Puppetfile'),
        this.destinationPath(puppetDir + 'Puppetfile')
      )

      //Puppet Manifests
      this.fs.copyTpl(
        this.templatePath(puppetDir + 'manifests/site.pp'),
        this.destinationPath(puppetDir + 'manifests/site.pp'), {
          appName: this.props.appName
        }
      );

      //Puppet Modules
      this.fs.copyTpl(
        this.templatePath(puppetDir + 'modules/nginx/templates/base.conf.epp'),
        this.destinationPath(puppetDir + 'modules/nginx/templates/' + this.props.appName + '.conf.epp'), {
          appName: this.props.appName,
          hostname: this.props.hostname
        }
      );

      this.fs.copyTpl(
        this.templatePath(puppetDir + 'modules/phpfpm/templates/base.conf.epp'),
        this.destinationPath(puppetDir + 'modules/phpfpm/templates/' + this.props.appName + '.conf.epp'), {
          appName: this.props.appName
        }
      );
    }
  },

  installSymfony: function() {
    var done = this.async();

    this.spawnCommand('composer', 
      ['create-project', 'symfony/framework-standard-edition', this.props.appName], 
      {cwd: this.appName}
    ).on('exit', function() { 
      var allowedIp = this.props.privateIp.match(/(\d+.\d+.\d+.)(\d+)/);
      replace({
        regex: "(\\$_SERVER\\['REMOTE_ADDR'\\], \\[)(.*)",
        replacement: '$1 \''+ allowedIp[1] +'1\', $2',
        paths: [this.props.appName + "/web/app_dev.php"]
      });

      done();
    }.bind(this));
  },

  install: function () {
    this.spawnCommand('vagrant', ['up']);
  }
});
