# Kubernetes manifests

Plain manifests, applied in file order. Tested target: local kind or minikube.

## kind
```bash
kind create cluster --name k2
docker build -t k2-base-lite-backend:local ../../backend
docker build -t k2-base-lite-frontend:local ../../frontend
kind load docker-image k2-base-lite-backend:local k2-base-lite-frontend:local --name k2
# ingress-nginx for kind
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl apply -f .
kubectl -n k2-base-lite get pods
kubectl -n k2-base-lite port-forward svc/frontend 8080:80
```

## minikube
```bash
minikube start
minikube addons enable ingress
minikube addons enable metrics-server   # needed for the HPA
eval $(minikube docker-env)
docker build -t k2-base-lite-backend:local ../../backend
docker build -t k2-base-lite-frontend:local ../../frontend
kubectl apply -f .
echo "$(minikube ip) k2-base-lite.local" | sudo tee -a /etc/hosts
```

## Notes
- `10-config.yaml` contains a demo Secret. Replace with Sealed Secrets or External Secrets in a real cluster.
- The HPA needs metrics-server.
- Next step would be a Helm chart or Kustomize overlays (dev/stage/prod).
