var path = require('path');

var ncp = require('ncp');
var rsvp = require('rsvp');

var nodeMxmlc = require('node-mxmlc');

module.exports = function (grunt) {
  grunt.registerMultiTask("mxmlc",
    "Compile Flex app using mxmlc SDK",
    function(buildName) {
        var mainConfig = this.options({
          root: process.cwd(),
          sdkVersion: null,
          configFile: null,
          define: null,
          buildFolder: null
        });

        var config = Object.create(mainConfig);

        config.name = this.target;

        Object.keys(this.data).forEach(function(key) {
          config[key] = this.data[key];
        }.bind(this));

        if (!config.configFile) {
          grunt.fatal('missing configFile value');
        }

        if (!config.out) {
          grunt.fatal('missing out value');
        }

        if (!config.playerglobal_home) {
          grunt.fatal('missing playerglobal_home value');
        }

        mainConfig.root = path.resolve(mainConfig.root);
        mainConfig.playerglobal_home = path.resolve(mainConfig.root, mainConfig.playerglobal_home);

        if (config.root !== mainConfig.root) {
          config.root = path.resolve(mainConfig.root, config.root);
          config.parentRoot = mainConfig.root;
        }

        if (config.playerglobal_home !== mainConfig.playerglobal_home) {
          config.playerglobal_home = path.resolve(config.root, config.playerglobal_home);
        }

        config.configFile = path.resolve(config.root, config.configFile);
        config.buildFolder = path.resolve(mainConfig.root, config.buildFolder);
        config.out = path.resolve(config.buildFolder, config.out);

        var done = this.async();

        console.log('config:', config);

        process.env.PLAYERGLOBAL_HOME = config.playerglobal_home;

        var wuillBuildAll = rsvp.Promise.resolve()
            .then(function() {
                return nodeMxmlc.getSdk(config.sdkVersion || nodeMxmlc.getDefaultVersion());
            })
            .then(function(sdk) {
                console.log('\n\nFlex SDK ' + sdk.version + ' available : ' + sdk.path);
                return sdk.exec;
            })
            .then(function(mxmlc) {
              var deferred = rsvp.defer();

              var args = [];

              args.push(
                '+projectRootFolder=' + config.root,
                '+buildFolder=' + config.buildFolder,
                '-load-config+=' + config.configFile,
                '-output=' + config.out
              );

              if (config.parentRoot) {
                args.push('+parentRoot=' + config.parentRoot);
              }

              if (config.define) {
                config.define.forEach(function(def) {
                  args.push('-define+=' + def);
                });
              }

              console.log('mxmlc arguments :\n\t' + args.join('\n\t'));

              var compile_process = mxmlc(args);

              console.log('\nProcessing build ' + config.name + '\n');

              // TODO: Improve catch outputs to be able to display in case of error
              // compile_process.stdout.pipe(process.stdout);
              compile_process.stderr.pipe(process.stderr);

              compile_process.on('close', function(code, signal) {
                if (code !== 0) {
                  var error = new Error('Compilation de ' + config.name + ' échouée');
                  error.exitCode = code;
                  error.signal = signal;
                  return deferred.reject(error);
                }

                console.log('Compilation de ' + config.name + ' OK');
                deferred.resolve();
              });

              return deferred.promise;
            })
            .then(function() {
              done();
            })
            .catch(function(reason) {
              grunt.fatal(reason);
            });
    }
  );
};