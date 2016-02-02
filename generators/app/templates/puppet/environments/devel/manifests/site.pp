/* Configuring  Repositories */
yumrepo { 'Webtatic':
  name       => 'Webtatic',
  mirrorlist => 'https://mirror.webtatic.com/yum/el7/x86_64/mirrorlist',
  gpgkey     => 'https://mirror.webtatic.com/yum/RPM-GPG-KEY-webtatic-el7'
}

yumrepo { 'Fish Shell':
  name    => 'Fish',
  baseurl => 'http://download.opensuse.org/repositories/shells:/fish:/release:/2/CentOS_7/',
  gpgkey  => 'http://download.opensuse.org/repositories/shells:/fish:/release:/2/CentOS_7//repodata/repomd.xml.key'
}

/* Some Essentials */

package { 'vim-enhanced':
  ensure => 'installed'
}

package { 'curl':
  ensure => 'installed'
}

class { 'gcc': }

exec { 'composer':
  command => 'curl -sS https://getcomposer.org/installer | sudo php -- --install-dir=/usr/local/bin --filename=composer',
  creates => '/usr/local/bin/composer',
  path    => ["/usr/bin", "/usr/sbin"],
  require => [Package['curl'], Package['php70w']]
}

package { 'fish':
  ensure => installed,
  require => Yumrepo['Fish Shell']
}

user { 'vagrant':
  ensure => present,
  shell  => '/usr/bin/fish'
}

file { '/usr/local/bin/sf':
  content => '#!/bin/bash
 PWD=$(pwd)
 while [ "$PWD" != \'/\' ]; do
   if [ -f "$PWD/symfony" ]; then
     php "$PWD/symfony" $@
     exit
   elif [ -f "$PWD/app/console" ]; then
     php "$PWD/app/console" $@
     exit
   elif [ -f "$PWD/bin/console" ]; then
     php "$PWD/bin/console" $@
     exit
   fi
   cd ..
 done
 echo \'Symfony file could not be found!\'',
  mode    => 'a+x'
}

/* Installing PHP, Database and Nginx */
$php = [
  'php70w',
  'php70w-common',
  'php70w-devel',
  'php70w-pgsql',
  'php70w-fpm',
  'php70w-xml',
  'php70w-intl',
  'php70w-opcache',
  'php70w-process'
]
package { $php:
  ensure  => 'installed',
  require => Yumrepo['Webtatic']
}

/* Configuring Everything */
augeas { "php.ini":
  require => Package['php70w'],
  context => "/files/etc/php.ini/PHP",
  changes => [
    "set date.timezone America/Sao_Paulo",
  ]
}

augeas { "nginx.conf":
  require => Package['nginx18'],
  context => "/files/etc/nginx/nginx.conf",
  changes => [
    "set user vagrant",
  ]
}

package { 'nginx18':
  ensure  => 'installed',
  require => Package['php70w']
}

file { '/etc/nginx/conf.d/<%= appName %>.conf':
  ensure  => file,
  content => epp('nginx/<%= appName %>.conf.epp'),
  require => Package['nginx18'],
  notify  => Service['nginx']
}

file { '/etc/php-fpm.d/<%= appName %>.conf':
  ensure  => file,
  content => epp('phpfpm/<%= appName %>.conf.epp'),
  require => Package['php70w'],
  notify  => Service['php-fpm']
}

service { 'nginx':
  ensure     => running,
  enable     => true,
  hasrestart => true,
  require    => File['/etc/nginx/conf.d/<%= appName %>.conf']
}

service { 'php-fpm':
  ensure        => running,
  hasstatus     => true,
  hasrestart    => true,
  enable        => true,
  require       => File['/etc/php-fpm.d/<%= appName %>.conf']
}

service { 'firewalld':
  ensure => 'stopped'
}

package { 'firewalld':
  ensure => absent
}

class { 'nodejs': }

exec { 'update-node-npm':
  command => 'sudo npm cache clean -f; sudo npm install -g n; sudo n stable;',
  require => Class['nodejs'],
  path => ['/usr/bin']
}

/* Database Administration */

class { 'postgresql::server':
  ip_mask_allow_all_users    => '0.0.0.0/0',
  listen_addresses           => '*',
}

postgresql::server::role { 'vagrant':
  password_hash => postgresql_password('vagrant', 'vagrant'),
  createdb => true
}