// Test script to verify shell plugin works
import { Command } from '@tauri-apps/plugin-shell';

async function testShellPlugin() {
  console.log('Testing Tauri shell plugin...');
  
  try {
    // Test git command
    const gitCmd = Command.create('git', ['--version']);
    const gitResult = await gitCmd.execute();
    console.log('Git version:', gitResult.stdout);
    
    // Test python command
    const pythonCmd = Command.create('python3', ['--version']);
    const pythonResult = await pythonCmd.execute();
    console.log('Python version:', pythonResult.stdout);
    
    // Test node command
    const nodeCmd = Command.create('node', ['--version']);
    const nodeResult = await nodeCmd.execute();
    console.log('Node version:', nodeResult.stdout);
    
    console.log('All tests passed!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testShellPlugin();