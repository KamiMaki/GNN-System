import os
import sys

# Add the current directory to sys.path to ensure we can import the module
sys.path.append(os.path.dirname(__file__))

from prepare_circuitnet import generate_circuitnet_dataset

# Define the path to save the data
data_dir = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(data_dir, exist_ok=True)
save_path = os.path.join(data_dir, 'circuitnet.pt')

print("Starting CircuitNet mock data generation...")
generate_circuitnet_dataset(save_path)

print("Mock data generation complete.")
print(f"CircuitNet dataset saved successfully at {save_path}")
