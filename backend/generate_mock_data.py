import os
import torch
from torch_geometric.datasets import Planetoid

# Define the path to save the data
data_dir = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(data_dir, exist_ok=True)
path = os.path.join(os.path.dirname(__file__), '..', 'data_cache') # A cache dir for pyg datasets
save_path = os.path.join(data_dir, 'cora.pt')

print("Downloading the Cora dataset...")
# Load the Cora dataset
dataset = Planetoid(root=path, name='Cora')
data = dataset[0]

print(f"Dataset downloaded. Saving to {save_path}...")
# Save the data object to a file
torch.save(data, save_path)

print("Mock data generation complete.")
print(f"Cora dataset saved successfully at {save_path}")
print("Dataset details:")
print(f"  - Nodes: {data.num_nodes}")
print(f"  - Edges: {data.num_edges}")
print(f"  - Features: {data.num_node_features}")
print(f"  - Classes: {dataset.num_classes}")
