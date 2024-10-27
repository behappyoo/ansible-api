const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const fs = require('fs');
const app = express();

app.use(bodyParser.json());

const ansibleHostsFile = '/etc/ansible/hosts';
const ansiblePlaybook_api = '/etc/ansible/playbook_api.yaml';
const ansiblePlaybook_web = '/etc/ansible/playbook_web.yaml';

app.post('/ansible/api', (req, res) => {
    // 요청에서 사설 IP (프라이빗 IP)와 SSH 키 이름 받기
    const { privateIp, keyName } = req.body;
  
    // 사설 IP 또는 키 이름이 없는 경우 에러 반환
    if (!privateIp || !keyName) {
      return res.status(400).send('Invalid request: missing private_ip or key_name');
    }
  
    // 동적으로 Ansible hosts 파일 업데이트 (프라이빗 IP 사용)
    const hostEntry = `
        [api_servers]
        ${privateIp} ansible_ssh_user=ec2-user ansible_ssh_private_key_file=${process.env.ANSIBLE_SSH_PRIVATE_KEY_FILE}
    `;
  
    // 호스트 파일에 새 인스턴스 정보 추가
    fs.appendFile(ansibleHostsFile, hostEntry, (err) => {
      if (err) {
        console.error('Error writing to hosts file:', err);
        return res.status(500).send('Failed to update Ansible hosts file.');
      }
  
      // Ansible Playbook 실행
      exec(`ansible-playbook ${ansiblePlaybook_api}`, (error, stdout, stderr) => {
        if (error) {
          console.error('Error running Ansible Playbook:', error);
          return res.status(500).send(`Ansible Playbook execution failed: ${error.message}`);
        }
  
        console.log('Ansible Playbook output:', stdout);
        res.status(200).send(`Deployment started for ${privateIp}`);
      });
    });
  });

  
  app.post('/ansible/web', (req, res) => {
    // 요청에서 사설 IP (프라이빗 IP)와 SSH 키 이름 받기
    const { privateIp, keyName } = req.body;
  
    // 사설 IP 또는 키 이름이 없는 경우 에러 반환
    if (!privateIp || !keyName) {
      return res.status(400).send('Invalid request: missing private_ip or key_name');
    }
  
    // 동적으로 Ansible hosts 파일 업데이트 (프라이빗 IP 사용)
    const hostEntry = `
        [web_servers]
        ${privateIp} ansible_ssh_user=ec2-user your_server ansible_ssh_private_key_file=${process.env.ANSIBLE_SSH_PRIVATE_KEY_FILE}
    `;
  
    // 호스트 파일에 새 인스턴스 정보 추가
    fs.appendFile(ansibleHostsFile, hostEntry, (err) => {
      if (err) {
        console.error('Error writing to hosts file:', err);
        return res.status(500).send('Failed to update Ansible hosts file.');
      }
  
      // Ansible Playbook 실행
      exec(`ansible-playbook ${ansiblePlaybook_web}`, (error, stdout, stderr) => {
        if (error) {
          console.error('Error running Ansible Playbook:', error);
          return res.status(500).send(`Ansible Playbook execution failed: ${error.message}`);
        }
  
        console.log('Ansible Playbook output:', stdout);
        res.status(200).send(`Deployment started for ${privateIp}`);
      });
    });
  });

  app.listen(3000, () => {
    console.log('Server running on http://localhost');
});