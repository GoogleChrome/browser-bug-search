
# -*- coding: utf-8 -*-
# Copyright 2013 Google Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License")
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

__author__ = 'ericbidelman@chromium.org (Eric Bidelman)'

import json
import logging
import os
import webapp2

from google.appengine.api import urlfetch


DEBUG = not os.getenv('SERVER_SOFTWARE', '').startswith('Google App Engine/')


class MainPage(webapp2.RequestHandler):

  def get(self):
    if not DEBUG:
      if self.request.referer and not self.request.url in self.request.referer:
        return

    url = self.request.get('url')
    if not url:
      self.response.set_status(404)
      return self.response.write('URL not specified')

    try:
      result = urlfetch.fetch(url)
      if result.status_code == 200:
        DEFAULT_TYPE = 'application/json; charset=utf-8'

        self.response.headers.add_header('Access-Control-Allow-Origin', '*')
        self.response.headers['Content-Type'] = (
            result.headers['Content-Type'] or DEFAULT_TYPE)

        return self.response.write(result.content)
      else:
        logging.error('Could not fetch url: %s' % url)
        self.response.set_status(result.status_code)
    except urlfetch.Error:
      logging.exception('Could not fetch url: %s' % url)


app = webapp2.WSGIApplication([
  ('/cors', MainPage),
], debug=DEBUG)
