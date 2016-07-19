var gulp = require('gulp'),
    jasmine = require('gulp-jasmine'),
    tslint = require('gulp-tslint');

gulp.task('lint', function() {
  return gulp.src([
    'src/**/**.ts',
    'spec/**.ts',
    'typings/**.d.ts'
  ])
  .pipe(tslint({ }))
  .pipe(tslint.report('verbose'));
});

gulp.task('tests', function() {
  return gulp.src('./lib/spec/*.js')
    .pipe(jasmine({ includeStackTrace: true, verbose: true }));
});

//alternative name for the 'tests' task
gulp.task('specs', ['tests']);

gulp.task('server', function() {
  require('./lib/src/server');
});
