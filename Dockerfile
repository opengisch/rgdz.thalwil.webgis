FROM ghcr.io/opengisch/qwc2_minimal-qwc2-minimal-builder:upgrade-to-qwc2-lts2024-7c964b3c86e5cf0b9d46df85e3db35f1988f331c as builder

COPY ./app/js/Help.jsx /app/js/Help.jsx
COPY ./app/js/SearchProviders.js /app/js/SearchProviders.js
COPY ./app/index.html /app/index.html

WORKDIR /app

RUN /usr/bin/make clean build

#==============
# Stage prod
#==============

FROM nginx:1.23.2 as prod

COPY --from=builder /app/prod /usr/share/nginx/html
