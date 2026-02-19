import os
import torch
from torch_geometric.data import Data
import numpy as np

def generate_circuitnet_dataset(save_path):
    print("Generating synthetic CircuitNet-like dataset (CircuitNet-N28-Mock)...")
    
    # CircuitNet (Net Delay) typically has geometric features (x, y, etc.)
    # We simulate a block with 1000 cells (nodes)
    num_nodes = 1000
    num_features = 4  # x, y, width, height (inspired by CircuitNet pin positions)
    
    # Features: Normalized coordinates [0, 1]
    # x[:, 0]: x-coordinate
    # x[:, 1]: y-coordinate
    # x[:, 2]: width
    # x[:, 3]: height
    x = torch.rand((num_nodes, num_features), dtype=torch.float)

    # Edges: Simulate a netlist (sparse graph)
    # Average degree ~4 (fan-in/fan-out)
    num_edges = num_nodes * 4
    edge_index = torch.randint(0, num_nodes, (2, num_edges), dtype=torch.long)

    # Labels: Simulate Congestion (Node Classification for compatibility)
    # Class 0: Safe
    # Class 1: Congested (e.g., nodes in dense regions or center)
    
    # Logic: Nodes close to center (0.5, 0.5) are 'congested'
    pos_x = x[:, 0]
    pos_y = x[:, 1]
    dist_to_center = torch.sqrt((pos_x - 0.5)**2 + (pos_y - 0.5)**2)
    
    # Threshold for congestion (approx 20-30% of nodes)
    y = (dist_to_center < 0.3).long() 

    # Create Masks for Train/Val/Test
    indices = torch.randperm(num_nodes)
    train_mask = torch.zeros(num_nodes, dtype=torch.bool)
    val_mask = torch.zeros(num_nodes, dtype=torch.bool)
    test_mask = torch.zeros(num_nodes, dtype=torch.bool)

    # 60/20/20 Split
    train_mask[indices[:int(num_nodes*0.6)]] = True
    val_mask[indices[int(num_nodes*0.6):int(num_nodes*0.8)]] = True
    test_mask[indices[int(num_nodes*0.8):]] = True

    data = Data(x=x, edge_index=edge_index, y=y)
    data.train_mask = train_mask
    data.val_mask = val_mask
    data.test_mask = test_mask
    
    # Metadata
    data.name = "CircuitNet-N28-Mock"

    print(f"Dataset generated. Saving to {save_path}...")
    torch.save(data, save_path)
    print("Done.")

if __name__ == "__main__":
    # Default path: autocircuitgnn/backend/data/cora.pt (replacing the default mock data)
    # We use 'cora.pt' filename if we want to replace the default directly without changing config,
    # OR we create 'circuitnet.pt'. 
    # The user asked to "replace original mock data". 
    # The original mock data was saved to 'cora.pt'.
    
    save_dir = os.path.join(os.path.dirname(__file__), 'data')
    os.makedirs(save_dir, exist_ok=True)
    
    # We will save as 'circuitnet.pt' AND 'cora.pt' to be safe, or just update the generator to save 'circuitnet.pt'
    # and update the app to use it.
    # Let's save as 'circuitnet.pt'
    save_path = os.path.join(save_dir, 'circuitnet.pt')
    generate_circuitnet_dataset(save_path)
