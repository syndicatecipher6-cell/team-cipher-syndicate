import pandas as pd
import networkx as nx
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import pickle
import random
import os

# Set paths
DATA_DIR = "../newtrainingdata1"
if not os.path.exists(DATA_DIR):
    DATA_DIR = "newtrainingdata1"

def load_graph():
    print("Loading data and building graph...")
    G = nx.Graph()
    person_features = {}
    
    try:
        # Load persons to get features
        persons = pd.read_csv(f"{DATA_DIR}/persons.csv")
        for _, row in persons.iterrows():
            flag = float(row.get('criminal_history_flag', 0))
            risk = float(row.get('risk_score', 0.0))
            person_features[row['person_id']] = [flag, risk]
            G.add_node(row['person_id'], type='person')
            
        # Load transactions
        txns = pd.read_csv(f"{DATA_DIR}/transactions.csv")
        for _, row in txns.iterrows():
            G.add_edge(row['sender_account_id'], row['receiver_account_id'], type='transaction')

        # Load phones
        phones = pd.read_csv(f"{DATA_DIR}/phones.csv")
        for _, row in phones.iterrows():
            G.add_edge(row['owner_person_id'], row['phone_id'], type='owns_phone')

        # Load accounts
        accounts = pd.read_csv(f"{DATA_DIR}/accounts.csv")
        for _, row in accounts.iterrows():
            G.add_edge(row['owner_person_id'], row['account_id'], type='owns_account')

        # Load person-case links
        pcl = pd.read_csv(f"{DATA_DIR}/person_case_link.csv")
        for _, row in pcl.iterrows():
            G.add_edge(row['person_id'], row['case_id'], type='involved_in')
            
        print(f"Graph built: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
        return G, person_features
    except Exception as e:
        print(f"Error loading graph: {e}")
        return G, person_features

def extract_features(G, person_features, node_u, node_v):
    features = []
    
    # Check if they are in the graph
    if node_u not in G or node_v not in G:
        return [0, 0, 0, 0, 0, 0, 0]
    
    # 1. Jaccard Coefficient
    preds = nx.jaccard_coefficient(G, [(node_u, node_v)])
    features.append(list(preds)[0][2])
    
    # 2. Adamic-Adar Index
    preds = nx.adamic_adar_index(G, [(node_u, node_v)])
    features.append(list(preds)[0][2])
    
    # 3. Preferential Attachment
    preds = nx.preferential_attachment(G, [(node_u, node_v)])
    features.append(list(preds)[0][2])
    
    # 4. Node Features (Criminal Flag, Risk Score)
    u_feats = person_features.get(node_u, [0.0, 0.0])
    v_feats = person_features.get(node_v, [0.0, 0.0])
    features.extend(u_feats)
    features.extend(v_feats)
    
    return features

def train_model():
    G, person_features = load_graph()
    if G.number_of_nodes() == 0:
        print("Empty graph. Make sure you run this script from the project root.")
        return

    # Load Ground Truth links for positive samples
    print("Preparing training data...")
    ground_truth = pd.read_csv(f"{DATA_DIR}/ground_truth_links.csv")
    
    X = []
    y = []
    
    # Positive samples
    for _, row in ground_truth.iterrows():
        u = row['entity_1']
        v = row['entity_2']
        if u in G and v in G:
            feats = extract_features(G, person_features, u, v)
            X.append(feats)
            y.append(1)
            
    num_positive = len(X)
    print(f"Found {num_positive} positive samples in graph.")

    # Negative samples (Random pairs not connected and not in ground truth)
    nodes = list(G.nodes())
    added_negatives = 0
    while added_negatives < num_positive * 2: # Imbalanced class ratio
        u = random.choice(nodes)
        v = random.choice(nodes)
        if u != v and not G.has_edge(u, v):
            feats = extract_features(G, person_features, u, v)
            # Only add if they have some connection (Jaccard > 0) to make it harder, or just randomly
            if random.random() > 0.5 or feats[0] > 0:
                X.append(feats)
                y.append(0)
                added_negatives += 1

    print(f"Added {added_negatives} negative samples.")
    
    X = np.array(X)
    y = np.array(y)
    
    if len(X) == 0:
        print("No samples generated. Aborting.")
        return

    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training Random Forest Classifier...")
    clf = RandomForestClassifier(n_estimators=100, random_state=42)
    clf.fit(X_train, y_train)
    
    # Evaluate
    print("Evaluating Model...")
    y_pred = clf.predict(X_test)
    print("\n--- CLASSIFICATION REPORT ---")
    print(classification_report(y_test, y_pred))
    print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")
    
    # Check if more data is needed
    acc = accuracy_score(y_test, y_pred)
    print("\n--- ANALYSIS ---")
    if acc < 0.70:
        print("CONCLUSION: The model is underfitting. We DEFINITELY need more data (more positive samples, diverse ground truth) or richer node features.")
    elif acc > 0.95:
        print("CONCLUSION: The model might be overfitting due to small dataset size. We need more diverse dataset to ensure it generalizes to real-world investigations.")
    else:
        print("CONCLUSION: The model has good initial performance, but more data is always beneficial for graph algorithms to find more complex, multi-hop patterns.")
        
    # Save
    os.makedirs("backend/models", exist_ok=True)
    with open("backend/models/investigation_model.pkl", "wb") as f:
        pickle.dump(clf, f)
    print("\nModel saved to backend/models/investigation_model.pkl")

if __name__ == "__main__":
    train_model()
