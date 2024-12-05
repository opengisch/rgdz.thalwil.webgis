FROM ghcr.io/opengisch/qwc2_minimal-qwc2-minimal-builder:upgrade-to-qwc2-lts2024-1a4ea6633c9bc5b16026a641d8c7ec5a24ffaf08 as builder

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
