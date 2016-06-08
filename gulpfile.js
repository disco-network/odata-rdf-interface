var gulp = require('gulp');
var jasmine = require('gulp-jasmine');

gulp.task('tests', function() {
  return gulp.src('./spec/*.js')
    .pipe(jasmine({ includeStackTrace: true, verbose: true }));
});

//alternative name for the 'tests' task
gulp.task('specs', ['tests']);
