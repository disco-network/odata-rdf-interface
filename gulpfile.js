var gulp = require('gulp'),
    jasmine = require('gulp-jasmine'),
	  //source = require('vinyl-source-stream'),
    //buffer = require('vinyl-buffer'),
    tslint = require('gulp-tslint'),
    tsc = require('gulp-typescript');
    //sourcemaps = require('gulp-sourcemaps'),
    //runSequence = require('run-sequence');

gulp.task('lint', function() {
  return gulp.src([
    'src/**/**.ts',
    'spec/**.ts'
  ])
  .pipe(tslint({ }))
  .pipe(tslint.report('verbose'));
})

var tsProject = tsc.createProject("tsconfig.json");
gulp.task('build', function() {
  return gulp.src([
    'src/**/**.ts',
    'spec/**.ts'
  ])
  .pipe(tsc(tsProject))
  .js.pipe(gulp.dest('.'));
})

gulp.task('tests', function() {
  return gulp.src('./spec/*.js')
    .pipe(jasmine({ includeStackTrace: true, verbose: true }));
});

//alternative name for the 'tests' task
gulp.task('specs', ['tests']);

gulp.task('server', function() {
  require('./src/server');
});
