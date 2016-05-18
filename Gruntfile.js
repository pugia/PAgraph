module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
      options: {
        reporter: require('jshint-stylish'), // use jshint-stylish to make our errors look and read good
				force: true,
				globals: {
	        jQuery: true
	      },
      },
	    build: {
		    src: 'src/js/PAgraph.js'
	    },
    },
    uglify: {
      build: {
        src: 'src/js/PAgraph.js',
        dest: 'dist/js/PAgraph.min.js'
      },
    },
    less: {
      build: {
        src: 'src/css/PAgraph.less',
        dest: 'src/css/PAgraph.css'
      },
    },
    cssmin: {
      build: {
        src: 'src/css/PAgraph.css',
        dest: 'dist/css/PAgraph.min.css'
      },
    },
		watch: {
		  scripts: {
		    files: ['Gruntfile.js', 'src/js/PAgraph.js'],
		    tasks: ['jshint', 'uglify'],
		    options: {
		      spawn: false,
		    },
		  },
		},
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // Default task(s).
  grunt.registerTask('default', ['jshint', 'uglify', 'less', 'cssmin']);

};