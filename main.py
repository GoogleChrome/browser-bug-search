
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
import jinja2
import webapp2

from google.appengine.api import urlfetch


DEBUG = not os.getenv('SERVER_SOFTWARE', '').startswith('Google App Engine/')

jinja_loader = jinja2.FileSystemLoader(os.path.dirname(__file__))
env = jinja2.Environment(
  loader=jinja_loader,
  extensions=['jinja2.ext.autoescape'],
  autoescape=True,
  trim_blocks=True,
  variable_start_string='{{',
  variable_end_string='}}')


def render(out, template, data={}):
  try:
    t = env.get_template(template)
    out.write(t.render(data).encode('utf-8'))
  except jinja2.exceptions.TemplateNotFound as e:
    handle_404(None, out, data, e)
  except Exception as e:
    handle_500(None, out, data, e)

def handle_404(req, resp, data, e):
  resp.set_status(404)
  # render(resp, '404.html', data)
  return resp.write('404 error')

def handle_500(req, resp, data, e):
  logging.exception(e)
  resp.set_status(500)
  # render(resp, '500.html', data);
  return resp.write('500 error')

class CorsHandler(webapp2.RequestHandler):

  def get(self):
    origin = 'https://%s' % self.request.environ['HTTP_HOST']

    if not DEBUG:
      if self.request.referer and not self.request.referer.startswith(origin):
        self.response.set_status(400)
        return self.response.write('No referer set.')

    url = self.request.get('url')
    if not url:
      self.response.set_status(404)
      return self.response.write('URL not specified')

    try:
      result = urlfetch.fetch(url)
      if result.status_code == 200:
        DEFAULT_TYPE = 'application/json; charset=utf-8'

        #self.response.headers.add_header('Access-Control-Allow-Origin', '*')
        self.response.headers['Content-Type'] = (
            result.headers['Content-Type'] or DEFAULT_TYPE)

        return self.response.write(result.content)
      else:
        logging.error('Could not fetch url: %s' % url)
        self.response.set_status(result.status_code)
    except urlfetch.Error:
      logging.exception('Could not fetch url: %s' % url)


class PageHandler(webapp2.RequestHandler):

  def get(self, path):
    #client_id = self.request.get('client')
    #if client_id != 'devsite':
    #  self.response.set_status(403)
    #  return self.response.write('client id "%s" not recognized' % client_id)

    data = {

    }

    if (path == 'devsite'):
      return render(self.response, 'devsite.html', data)

    render(self.response, 'index.html', data)


app = webapp2.WSGIApplication([
  ('/cors', CorsHandler),
  ('/(.*)', PageHandler),
], debug=DEBUG)
