# WebGIS Thalwil

## Local DEV setup
Run the docker compose file to fire up a local instance of the webGIS. It mounts the contents of
the app folder and also the configuration files copied from Thalwil TEST env (themes.json, config.json). 


### Prevent CORS issues
To prevent CORS issues, the following automatic and manual steps are taken.

- Search: A proxy service in the docker compose redirects search requests from localhost:8888 to the TEST env
- Map click / feature info: In themes.json, replace `"featureInfoUrl": "https://maps-test.thalwil.ch` with `"featureInfoUrl": "http://localhost:8888` to point at the proxy
- Theme and basemap thumbnails: These still suffer from CORS blocks, no solution yet
