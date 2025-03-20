# WebGIS Thalwil

## Local DEV setup
Run the docker compose file to fire up a local instance of the webGIS. It mounts the contents of
the app folder and uses the configuration files (themes.json, config.json) in the `dev` directory. These were copied from Thalwil TEST env.

Note that files in the `dev` directory and the `docker-compose.yaml` are only needed for local development work
and do not get added to the final docker image.

## Release a new version
Relevant for a production release are the `Dockerfile` and files in the `app` directory.
The following steps are necessary when releasing a new version.

Optional prerequisite when doing a major upgrade:
1. Manually upgrade [opengisch qwc_minimal repository](https://github.com/opengisch/qwc2_minimal) to the latest LTS version of [QWC2](https://github.com/qgis/qwc2-demo-app)
2. Update the files in `app` to fit with the newest version

Then, customer specific changes can be applied in this repo:
1. Add or change files in `app`
2. Update the image tag in the `Dockerfile`, e.g.:
   3. `from 2024-lts.0` to `2024-lts.1` 
   4. or when doing a major upgrade: `2025-lts.0`
3. In the [rgdz.thalwil.deployment repo](https://github.com/opengisch/rgdz.thalwil.deployment/tree/master), update the docker image URL to point at the new image version
4. On the production server, pull rgdz.thalwil.deployment repo 
5. Restart docker containers


By only updating the URL for dev and/or test environment in step 3, you can test changes without touching production.
