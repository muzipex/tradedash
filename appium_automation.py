from appium import webdriver
from appium.webdriver.common.appiumby import AppiumBy
import time
import subprocess

class MT5MobileAutomation:
    def __init__(self, platform_version, app_package, app_activity, appium_server_url):
        self.platform_version = platform_version
        self.app_package = app_package
        self.app_activity = app_activity
        self.appium_server_url = appium_server_url
        self.driver = None

    def get_device_name(self):
        result = subprocess.run(['adb', 'devices'], stdout=subprocess.PIPE)
        devices = result.stdout.decode('utf-8').strip().split('\n')[1:]
        if devices:
            return devices[0].split('\t')[0]
        return "Android Emulator"

    def start_driver(self):
        desired_caps = {
            "platformName": "Android",
            "deviceName": self.get_device_name(),
            "platformVersion": self.platform_version,
            "appPackage": self.app_package,
            "appActivity": self.app_activity,
            "automationName": "UiAutomator2"
        }
        self.driver = webdriver.Remote(self.appium_server_url, desired_caps)

    def login(self, account_id, password, server):
        self.start_driver()
        time.sleep(5)  # Wait for the app to load

        # Locate and interact with elements to perform login
        self.driver.find_element(AppiumBy.ID, "com.metaquotes.metatrader5:id/login").send_keys(account_id)
        self.driver.find_element(AppiumBy.ID, "com.metaquotes.metatrader5:id/password").send_keys(password)
        self.driver.find_element(AppiumBy.ID, "com.metaquotes.metatrader5:id/server").send_keys(server)
        self.driver.find_element(AppiumBy.ID, "com.metaquotes.metatrader5:id/login_button").click()

        time.sleep(10)  # Wait for login to complete

        # Check if login was successful
        if "dashboard" in self.driver.current_activity:
            return True
        return False

    def stop_driver(self):
        if self.driver:
            self.driver.quit()
