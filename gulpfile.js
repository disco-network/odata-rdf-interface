"use strict";
var gulp = require('gulp'),
  mocha = require('gulp-mocha'),
  tslint = require('gulp-tslint'),
  tsc = require('gulp-typescript'),
  sourcemaps = require('gulp-sourcemaps');

gulp.task('lint', function () {
  return gulp.src([
    'src/**/**.ts',
    'spec/**.ts',
    'typings/**.d.ts'
  ])
    .pipe(tslint({}))
    .pipe(tslint.report('verbose'));
});

var tsProjectForJs = tsc.createProject("tsconfig.json");
var tsProjectForDts = tsc.createProject("tsconfig.json");
gulp.task('build', ['build-js']);
gulp.task('dist', ['build-js', 'build-dts']);
gulp.task('build-js', function () {
  return gulp.src([
    './**/**.ts',
    '!./lib/**',
    '!./node_modules/**'
  ])
    .pipe(sourcemaps.init())
    .pipe(tsc(tsProjectForJs))
    .js
    .pipe(sourcemaps.write('../maps', {
      includeContent: false,
      sourceRoot: function (file) {
        // needed to fix relative path in sourceMaps
        var path = '../'.repeat((file.relative.match(/\//g) || []).length + 1);
        return path;
      }
    }))
    .pipe(gulp.dest('lib'));
})

gulp.task('build-dts', function () {
  return gulp.src([
    './**/**.ts',
    '!./lib/**',
    '!./node_modules/**'
  ])
    .pipe(tsc(tsProjectForDts))
    .dts
    .pipe(gulp.dest('lib'));
})

gulp.task('tests-no-build', function () {
  return gulp.src('./lib/spec/*.js')
    .pipe(mocha());
});

gulp.task('tests', ['build'], function () {
  return gulp.src('./lib/spec/*.js')
    .pipe(mocha());
});

//alternative name for the 'tests' task
gulp.task('specs', ['tests']);

gulp.task('server', function () {
  require('./lib/src/server');
});
