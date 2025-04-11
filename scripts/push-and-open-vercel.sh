#!/bin/bash

# Push to the specified remote and branch, then open Vercel deployments
git push "$@" && open "https://vercel.com/wewrite-apps-projects/wewrite-next-js/deployments"
