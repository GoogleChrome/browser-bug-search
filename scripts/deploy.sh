#!/bin/bash
#
# Builds the site.
#
# Copyright 2016 Eric Bidelman <ericbidelman@chromium.org>


# The directory in which this script resides.
readonly BASEDIR=$(dirname $BASH_SOURCE)

vulcanize --inline-css --inline-scripts --strip-comments $BASEDIR/../bower_components/polymer/polymer.html \
    -o $BASEDIR/../bower_components/polymer/polymer.vulcanized.html

appcfg.py update $BASEDIR/../
