# https://hub.docker.com/_/node
ARG node_ver=25
FROM node:${node_ver}-alpine3.22

ARG haraka_ver=3.1.1
ARG build_rev=0

COPY haraka /haraka

RUN apk update
RUN apk upgrade
RUN apk add --no-cache ca-certificates
RUN update-ca-certificates
RUN apk add --no-cache --virtual .build-deps python3 g++ make openssl
RUN npm install -g Haraka@${haraka_ver}
RUN chmod +x /haraka/docker-entrypoint.sh
RUN apk del .build-deps && rm -rf /var/cache/apk/* /root/.npm/* /tmp/*

ENV HARAKA_HOME=/haraka

EXPOSE 25 587

ENTRYPOINT ["/haraka/docker-entrypoint.sh"]

CMD ["-c", "/haraka"]
