const path = require('path');

module.exports = function(grunt) {
    grunt.initConfig({
        babel: {
            options: {
                sourceMap: true,
                presets: [['@babel/preset-env', { modules: false }]],
                moduleIds: true,
                getModuleId: function(name) {
                    // 'name' is coming in as an absolute path. 
                    // We extract just the filename (without extension).
                    var filename = path.basename(name, '.js');
                    return 'block_timestat/' + filename;
                },
                plugins: [['@babel/plugin-transform-modules-amd', { noInterop: false }]]
            },
            dist: {
                files: [{
                    expand: true,
                    cwd: 'amd/src/',
                    src: ['**/*.js'],
                    dest: 'amd/build/',
                    rename: function(dest, src) {
                        return dest + src.replace(/\.js$/, '.min.js');
                    }
                }]
            }
        },
        uglify: {
            options: {
                sourceMap: true,
                sourceMapIn: function(uglifyDest) {
                    return uglifyDest + '.map';
                }
            },
            dist: {
                files: [{
                    expand: true,
                    cwd: 'amd/build/',
                    src: ['**/*.min.js'],
                    dest: 'amd/build/'
                }]
            }
        }
    });

    grunt.loadNpmTasks('grunt-babel');
    grunt.loadNpmTasks('grunt-contrib-uglify');

    grunt.registerTask('default', ['babel', 'uglify']);
};