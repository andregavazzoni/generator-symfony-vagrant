'use strict';
var yeoman = require('yeoman-generator');
var chalk = require('chalk');
var yosay = require('yosay');
var replace = require('replace');
var exec = require('child_process').exec;

module.exports = yeoman.generators.Base.extend({
  initializing: function () {
    if (this.fs.exists('Vagrantfile')) {
      var done = this.async();
      this.spawnCommand('vagrant', ['destroy', '--force']).on('exit', function () {
        done();
      });
    }
  },

  prompting: function () {
    var done = this.async();

    // Have Yeoman greet the user.
    this.log(yosay(
      'Welcome to the ' + chalk.red('Symfony-Vagrant') + ' generator!'
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
      default: this.appname + '.local'
    }, {
      type: 'input',
      name: 'privateIp',
      message: 'Choose a nice ' + chalk.yellow('Private IP Address') + ' for your VM:',
      default: '192.168.100.10'
    }, {
      type: 'confirm',
      name: 'provision',
      message: 'Last, tell us if you want to use our ' + chalk.yellow('Puppet Provisioning') + ':',
      default: true
    }, {
      type: 'confirm',
      name: 'editHosts',
      message: 'Would you like to update your hosts file ? (sudo required)',
      default: false
    }, {
      type: 'confirm',
      name: 'launchVM',
      message: 'Would you like to launch your VM now ?',
      default: false
    }];

    this.prompt(prompts, function (props) {
      this.props = props;
      done();
    }.bind(this));
  },

  writing: {
    vagrant: function () {
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

    puppet: function () {
      var puppetDir = 'puppet/environments/devel/';

      this.mkdir(puppetDir + 'vendor');

      this.fs.copy(
        this.templatePath(puppetDir + 'Puppetfile'),
        this.destinationPath(puppetDir + 'Puppetfile')
      );

      // Puppet Manifests
      this.fs.copyTpl(
        this.templatePath(puppetDir + 'manifests/site.pp'),
        this.destinationPath(puppetDir + 'manifests/site.pp'), {
          appName: this.props.appName
        }
      );

      // Puppet Modules
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

  installSymfony: function () {
    var done = this.async();

    this.spawnCommand('composer',
      ['create-project', 'symfony/framework-standard-edition', this.props.appName, '-n'],
      {cwd: this.appName}
    )
    .on('error', function () {
      this.log(chalk.red('Composer not installed.'));
    }.bind(this))
    .on('exit', function () {
      var allowedIp = this.props.privateIp.match(/(\d+.\d+.\d+.)(\d+)/);
      replace({
        regex: '(\\$_SERVER\\[\'REMOTE_ADDR\'\\], \\[)(.*)',
        replacement: '$1 \'' + allowedIp[1] + '1\', $2',
        paths: [this.props.appName + '/web/app_dev.php']
      });

      done();
    }.bind(this));
  },

  install: {
    hosts: function () {
      if (this.props.editHosts) {
        var done = this.async();
        this.log(chalk.yellow('We\'ll need to run the next step as SUDO'));
        exec('sudo sed \'$ i\\' + this.props.privateIp + ' ' + this.props.hostname + '\' /etc/hosts -i', err => {
          if (err) {
            this.log(err);
            return;
          }
          done();
          this.log(chalk.green('Hosts file updated'));
        });
      }
    },

    vagrant: function () {
      if (this.props.launchVM) {
        var done = this.async();
        this.spawnCommand('vagrant', ['up']).on('exit', function () {
          done();
        });
      }
    }
  }
});
