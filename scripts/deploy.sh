#!/bin/sh

# Copyright 2016 Google Inc. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

#  This script builds and deploys the site.


# The directory in which this script resides.
readonly BASEDIR=$(dirname $BASH_SOURCE)

vulcanize --inline-css --inline-scripts --strip-comments $BASEDIR/../bower_components/polymer/polymer.html \
    -o $BASEDIR/../bower_components/polymer/polymer.vulcanized.html

appcfg.py update $BASEDIR/../
