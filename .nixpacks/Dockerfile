FROM ghcr.io/railwayapp/nixpacks:ubuntu-1733184274

ENTRYPOINT ["/bin/bash", "-l", "-c"]
WORKDIR /app/


COPY .nixpacks/nixpkgs-5624e1334b26ddc18da37e132b6fa8e93b481468.nix .nixpacks/nixpkgs-5624e1334b26ddc18da37e132b6fa8e93b481468.nix
RUN nix-env -if .nixpacks/nixpkgs-5624e1334b26ddc18da37e132b6fa8e93b481468.nix && nix-collect-garbage -d


ARG CI GIT_SHA NIXPACKS_METADATA NODE_ENV NPM_CONFIG_PRODUCTION
ENV CI=$CI GIT_SHA=$GIT_SHA NIXPACKS_METADATA=$NIXPACKS_METADATA NODE_ENV=$NODE_ENV NPM_CONFIG_PRODUCTION=$NPM_CONFIG_PRODUCTION

# setup phase
# noop

# install phase
ENV NIXPACKS_PATH=/app/node_modules/.bin:$NIXPACKS_PATH
COPY . /app/.
RUN  npm ci

# build phase
# noop


RUN printf '\nPATH=/app/node_modules/.bin:$PATH' >> /root/.profile


# start
COPY . /app

CMD ["node app.js"]

