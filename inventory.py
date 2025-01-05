import boto3
import json
import subprocess
import os
from flask import Flask, request, jsonify

# AWS 리전 설정
region = 'ap-northeast-2'

# Flask 설정
app = Flask(__name__)

def get_autoscaling_instances_by_group(group_name):
    try:
        ec2 = boto3.client('ec2', region_name=region)

        as_instances = ec2.describe_instances(Filters=[
            {'Name': 'tag:aws:autoscaling:groupName', 'Values': [group_name]},
            {'Name': 'instance-state-name', 'Values': ['running']}
        ])

        inventory = {
            "_meta": {
                "hostvars": {}
            },
            group_name: {
                "hosts": {}  
            }
        }

        for reservation in as_instances['Reservations']:
            for instance in reservation['Instances']:
                private_ip = instance.get('PrivateIpAddress')
                if private_ip:
                    inventory[group_name]["hosts"][private_ip] = {}
                    inventory["_meta"]["hostvars"][private_ip] = {
                        "ansible_host": private_ip
                    }

        # 디버깅 출력: 변환된 결과 확인
        print("Generated inventory:", json.dumps(inventory, indent=2))            

        return inventory
    except Exception as e:
        print(f"Error retrieving instances for {group_name}: {e}")
        return None


@app.route('/run-playbook', methods=['POST'])
def run_playbook():
    data = request.json
    group_name = data.get('group_name')

    if not group_name:
        return jsonify({"error": "group_name is required"}), 400

    inventory = get_autoscaling_instances_by_group(group_name)
    if not inventory:
        return jsonify({"error": "Failed to retrieve inventory"}), 500

    # 인벤토리 파일 저장
    inventory_path = f'inventory_{group_name}.json'
    with open(inventory_path, 'w') as f:
        json.dump(inventory, f, indent=2)

    # Ansible 플레이북 실행
    playbook_path = f'/etc/ansible/playbook_{group_name}.yaml'
    ssh_key = os.environ.get("ANSIBLE_SSH_KEY")
    vault_password = os.environ.get("VAULT_PASSWORD")
    command = ['ansible-playbook', '-i', inventory_path, playbook_path, '--private-key', ssh_key, '--vault-password', vault_password]

    try:
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode == 0:
            return jsonify({"message": "Playbook executed successfully", "output": result.stdout}), 200
        else:
            return jsonify({"error": "Playbook execution failed", "details": result.stderr}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)