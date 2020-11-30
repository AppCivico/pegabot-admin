#!/usr/bin/env bash
export INSIDE_WORKSPACE=/var/jenkins_home/dev-persistent/$JOB_NAME

mkdir -p $INSIDE_WORKSPACE/src
mkdir -p $INSIDE_WORKSPACE/data
# chown 1000:1000 $INSIDE_WORKSPACE/data -R

rsync -av $WORKSPACE/ $INSIDE_WORKSPACE/src;

cd $INSIDE_WORKSPACE/src;

docker-compose up -d --build