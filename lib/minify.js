var fs = require('fs');
var path = require('path');

var CleanCSS = require('clean-css');
var crass = require('crass');
var cssnano = require('cssnano');
var csso = require('csso');
var csswring = require('csswring');

var gzipSize = require('gzip-size');
var Q = require('q');

// MINIFIERS
var minifiers = {
  'clean-css': function(source) {
    return new CleanCSS({ inline: false }).minify(source).styles;
  },
  'clean-css (level 2)': function(source) {
    return new CleanCSS({ level: 2, inline: false }).minify(source).styles;
  },
  'crass': function(source) {
    return String(crass.parse(source).optimize({ o1: true }));
  },
  'crass (o1 off)': function(source) {
    return String(crass.parse(source).optimize());
  },
  'cssnano': function (source) {
    return cssnano.process(source, { safe: true }).then(function (result) {
      return result.css;
    });
  },
  'cssnano (safe off)': function (source) {
    return cssnano.process(source).then(function (result) {
      return result.css;
    });
  },
  'csso': function(source) {
    return csso.minify(source).css;
  },
  'csso (restructure off)': function(source) {
    return csso.minify(source, { restructure: false }).css;
  },
  'csswring': function (source) {
    return csswring.wring(source).css;
  }
};

var gzippedSize = {};

function getMinifierInfo (name) {
  var packageName = name.split(' ')[0];
  var packageDefinition = JSON.parse(fs.readFileSync(path.join('node_modules', packageName, 'package.json')));
  var repositoryUrl;
  if (packageDefinition.repository && packageDefinition.repository.url) {
    repositoryUrl = packageDefinition.repository.url
      .replace(/(^git:\/\/)|(^git\+https:\/\/)|(^git\+ssh:\/\/git@)/, 'https://')
      .replace(/\.git$/, '');
  }
  if (!repositoryUrl) {
    repositoryUrl = packageDefinition.homepage;
  }
  var version = packageDefinition.version;

  return {
    name: name,
    version: version,
    url: repositoryUrl,
    results: {}
  };
}

exports.getActive = function (only) {
  var activeMinifiers = [];
  for (var name in minifiers) {
    if (only.test(name))
      activeMinifiers.push(getMinifierInfo(name));
  }
  return activeMinifiers;
};

exports.measure = function (minifierName, source, gzip) {
  var start = process.hrtime();
  var maybeMinified = minifiers[minifierName](source);
  return Q(maybeMinified).then(function (minified) {
    var itTook = process.hrtime(start);
    var took = Math.round((1000 * itTook[0] + itTook[1] / 1000000) * 100) / 100;
    if (gzip && !gzippedSize[source])
      gzippedSize[source] = gzipSize.sync(source);

    return {
      time: took,
      size: minified.length,
      gzip: gzip ? gzipSize.sync(minified) : NaN,
      originalsize: source.length,
      originalgzip: gzippedSize[source]
    };
  });
};
