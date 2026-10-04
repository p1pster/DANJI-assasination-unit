export type KaliToolSection = {
  name: string
  tools: string[]
}

export type KaliToolCategory = {
  name: string
  summary: string
  sections: KaliToolSection[]
}

export const kaliToolsSource = 'https://www.kali.org/tools/'

export const kaliToolCategories: KaliToolCategory[] = [
  {
    "name": "Reconnaissance",
    "summary": "Information gathering, network discovery, web enumeration, wireless reconnaissance and vulnerability discovery.",
    "sections": [
      {
        "name": "Host Information",
        "tools": [
          "metagoofil",
          "spiderfoot",
          "spiderfoot-cli"
        ]
      },
      {
        "name": "Identity Information",
        "tools": [
          "email2phonenumber",
          "emailharvester",
          "instaloader",
          "linkedin2username",
          "photon",
          "sherlock",
          "tookie-osint"
        ]
      },
      {
        "name": "Network Information",
        "tools": [
          "amass",
          "autorecon",
          "dmitry",
          "legion",
          "nmap",
          "zenmap",
          "theHarvester",
          "unicornscan"
        ]
      },
      {
        "name": "Network Information: DNS",
        "tools": [
          "dnsmap",
          "dnsrecon",
          "dnsenum",
          "massdns",
          "dnstracer",
          "dnswalk"
        ]
      },
      {
        "name": "Web Scanning",
        "tools": [
          "assetfinder",
          "arjun",
          "dirb",
          "dirbuster",
          "dirsearch",
          "feroxbuster",
          "ffuf",
          "finalrecon",
          "findomain",
          "gobuster",
          "gospider",
          "lbd",
          "parsero",
          "recon-ng",
          "subfinder",
          "sublist3r",
          "uniscan-gui",
          "urlcrazy",
          "uro",
          "wfuzz",
          "wpprobe"
        ]
      },
      {
        "name": "Vulnerability Scanning",
        "tools": [
          "nmap",
          "zenmap",
          "CAT",
          "gvm-start",
          "heartleech",
          "owasp-mantra-ff"
        ]
      },
      {
        "name": "Web Vulnerability Scanning",
        "tools": [
          "burpsuite",
          "caido",
          "caido-cli",
          "crlfuzz",
          "davtest",
          "joomscan",
          "nikto",
          "nuclei",
          "paros",
          "skipfish",
          "sstimap",
          "subjack",
          "tinja",
          "wapiti",
          "watobo",
          "wcvs",
          "webscarab",
          "whatweb",
          "wpscan",
          "zaproxy"
        ]
      },
      {
        "name": "Bluetooth",
        "tools": [
          "bettercap",
          "bluelog",
          "bluesnarfer",
          "btscanner",
          "blueranger",
          "fang",
          "spooftooph",
          "ubertooth-util"
        ]
      },
      {
        "name": "WiFi",
        "tools": [
          "asleap",
          "bettercap",
          "kismet",
          "sparrow-wifi",
          "wash"
        ]
      },
      {
        "name": "Radio Frequency",
        "tools": [
          "hackrf_info",
          "gnuradio",
          "gqrx",
          "chirp",
          "rfcat"
        ]
      },
      {
        "name": "General / Featured",
        "tools": [
          "photon",
          "bettercap",
          "burpsuite",
          "caido",
          "dirb",
          "dirbuster",
          "ffuf",
          "gobuster",
          "legion",
          "maltego",
          "nmap",
          "recon-ng",
          "zenmap"
        ]
      }
    ]
  },
  {
    "name": "Resource Development",
    "summary": "Development, packaging, fuzzing, reverse engineering and exploit-development utilities.",
    "sections": [
      {
        "name": "All tools",
        "tools": [
          "code-oss",
          "donut",
          "sickle-pdk",
          "wixl",
          "wmic",
          "wmis",
          "pyinstaller",
          "olevba",
          "olefile",
          "afl-fuzz",
          "bed",
          "generic_chunked",
          "generic_listen_tcp",
          "generic_send_tcp",
          "generic_send_udp",
          "sfuzz",
          "msf-nasm_shell",
          "msfvenom",
          "msfpc",
          "shellnoob",
          "clang",
          "clang++",
          "edb",
          "ollydbg",
          "gef",
          "gdb",
          "cstool",
          "ghidra",
          "radare2",
          "rizin",
          "cutter",
          "recstudio",
          "recstudio-cli",
          "apktool",
          "bytecode-viewer",
          "jadx-gui",
          "javasnoop",
          "jd-gui",
          "d2j-dex2jar",
          "pompem",
          "searchsploit",
          "exploitdb-papers"
        ]
      }
    ]
  },
  {
    "name": "Initial Access",
    "summary": "Tools Kali groups around controlled initial-access testing in authorised environments.",
    "sections": [
      {
        "name": "All tools",
        "tools": [
          "dns-rebind",
          "gophish-start",
          "setoolkit",
          "metasploit-framework",
          "sqlmap",
          "sqlninja",
          "sqlsus",
          "jsql",
          "commix",
          "jboss-linux",
          "jboss-win"
        ]
      }
    ]
  },
  {
    "name": "Execution",
    "summary": "Utilities used in labs to study execution paths, frameworks and scripting behaviour.",
    "sections": [
      {
        "name": "All tools",
        "tools": [
          "armitage",
          "metasploit-framework",
          "evilgrade",
          "beef-xss-start",
          "xsser",
          "nishang",
          "powersploit"
        ]
      }
    ]
  },
  {
    "name": "Persistence",
    "summary": "Kali packages grouped around persistence research and web-shell detection/testing in controlled systems.",
    "sections": [
      {
        "name": "All tools",
        "tools": [
          "laudanum",
          "phpggc",
          "seclists",
          "webacoo",
          "webshells",
          "weevely",
          "backdoor-factory",
          "cymothoa"
        ]
      }
    ]
  },
  {
    "name": "Privilege Escalation",
    "summary": "Auditing and lab utilities for identifying privilege-escalation paths and configuration weaknesses.",
    "sections": [
      {
        "name": "All tools",
        "tools": [
          "lynis",
          "metasploit-framework",
          "peass",
          "linpeas",
          "winpeas",
          "unix-privesc-check",
          "bloodyad"
        ]
      }
    ]
  },
  {
    "name": "Defense Evasion",
    "summary": "Tools Kali classifies around evasion research, identity material handling and steganography.",
    "sections": [
      {
        "name": "Pass-the-Hash",
        "tools": [
          "crackmapexec",
          "evil-winrm",
          "evil-winrm-py",
          "impacket-scripts",
          "mimikatz",
          "netexec",
          "passing-the-hash",
          "rubeus",
          "smbmap",
          "xfreerdp3"
        ]
      },
      {
        "name": "General",
        "tools": [
          "sniffjoke",
          "ftest",
          "fragrouter",
          "macchanger",
          "outguess",
          "steghide",
          "stegosuite",
          "stegsnow",
          "donut",
          "exe2hex",
          "msfvenom",
          "shellter",
          "veil",
          "ccrypt",
          "padbuster"
        ]
      }
    ]
  },
  {
    "name": "Credential Access",
    "summary": "Password auditing, credential discovery and authentication-testing tools for authorised assessments.",
    "sections": [
      {
        "name": "OS Credential Dumping",
        "tools": [
          "chntpw",
          "creddump7",
          "mimikatz",
          "rubeus",
          "samdump2"
        ]
      },
      {
        "name": "Hash Identification",
        "tools": [
          "hashid",
          "hash-identifier"
        ]
      },
      {
        "name": "Password Profiling & Wordlists",
        "tools": [
          "bopscrk",
          "cewl",
          "crunch",
          "maskgen",
          "policygen",
          "rsmangler",
          "seclists",
          "statsgen",
          "twofi",
          "wordlists"
        ]
      },
      {
        "name": "Brute Force",
        "tools": [
          "CAT",
          "crackmapexec",
          "crowbar",
          "hydra",
          "hydra-gtk",
          "legba",
          "medusa",
          "ncrack",
          "netexec",
          "patator",
          "sqldict",
          "thc-pptp-bruter"
        ]
      },
      {
        "name": "Password Cracking",
        "tools": [
          "cmospwd",
          "crackle",
          "fcrackzip",
          "hashcat",
          "john",
          "johnny",
          "ophcrack",
          "ophcrack-cli",
          "rcrack",
          "rcracki_mt",
          "sipcrack",
          "sucrack",
          "truecrack"
        ]
      },
      {
        "name": "Unsecured Credentials",
        "tools": [
          "gitxray",
          "trufflehog"
        ]
      },
      {
        "name": "WiFi Credential Access",
        "tools": [
          "aircrack-ng",
          "airgeddon",
          "bully",
          "cowpatty",
          "eapmd5pass",
          "fern-wifi-cracker",
          "freeradius",
          "pixiewps",
          "reaver",
          "wifi-honey",
          "wifiphisher",
          "wifite"
        ]
      },
      {
        "name": "Keylogger",
        "tools": [
          "xspy"
        ]
      },
      {
        "name": "VoIP Credential Access",
        "tools": [
          "svcrack",
          "enumiax"
        ]
      },
      {
        "name": "NFC",
        "tools": [
          "mfcuk",
          "mfoc",
          "mfterm",
          "mifare-classic-format",
          "nfc-list",
          "nfc-mfclassic"
        ]
      },
      {
        "name": "Kerberoasting",
        "tools": [
          "kerberoast",
          "krbrelayx"
        ]
      },
      {
        "name": "General / Featured",
        "tools": [
          "responder",
          "cewl",
          "crunch",
          "hashcat",
          "hydra",
          "hydra-gtk",
          "john",
          "medusa",
          "ncrack",
          "ophcrack",
          "wordlists",
          "netexec"
        ]
      }
    ]
  },
  {
    "name": "Discovery",
    "summary": "Network, service, account, directory, database and protocol discovery utilities.",
    "sections": [
      {
        "name": "Network Service Discovery",
        "tools": [
          "amass",
          "autorecon",
          "masscan",
          "nmap",
          "zenmap",
          "sctpscan",
          "unicornscan",
          "ike-scan"
        ]
      },
      {
        "name": "SSL / TLS",
        "tools": [
          "sslscan",
          "sslyze",
          "tlssled"
        ]
      },
      {
        "name": "SNMP",
        "tools": [
          "snmp-check",
          "braa",
          "onesixtyone"
        ]
      },
      {
        "name": "Network Sniffing",
        "tools": [
          "above",
          "arpspoof",
          "darkstat",
          "dnschef",
          "driftnet",
          "dsniff",
          "hexinject",
          "netsniff-ng",
          "wireshark",
          "scapy",
          "tcpdump",
          "tcpflow"
        ]
      },
      {
        "name": "Remote System Discovery",
        "tools": [
          "arping",
          "arpwatch",
          "atk6-thcping6",
          "fierce",
          "fping",
          "hping3",
          "iputils-arping",
          "p0f"
        ]
      },
      {
        "name": "Account Discovery",
        "tools": [
          "apache-users",
          "smtp-user-enum"
        ]
      },
      {
        "name": "Network Share Discovery",
        "tools": [
          "crackmapexec",
          "enum4linux",
          "enum4linux-ng",
          "nbtscan",
          "netexec",
          "smbclient",
          "smbmap"
        ]
      },
      {
        "name": "Process Discovery",
        "tools": [
          "pspy",
          "pspy-binaries"
        ]
      },
      {
        "name": "System Network Configuration Discovery",
        "tools": [
          "0trace.sh",
          "ass",
          "cdp",
          "intrace",
          "netdiscover",
          "netmask",
          "sara",
          "yersinia"
        ]
      },
      {
        "name": "Network Security Appliances",
        "tools": [
          "firewalk",
          "tcpreplay",
          "wafw00f"
        ]
      },
      {
        "name": "Databases",
        "tools": [
          "impacket-mssqlclient",
          "mdb-sql",
          "mysql",
          "oscanner",
          "sidguess",
          "sqlitebrowser",
          "tnscmd10g"
        ]
      },
      {
        "name": "SMTP",
        "tools": [
          "mxcheck",
          "smtp-user-enum",
          "swaks"
        ]
      },
      {
        "name": "Cisco Tools",
        "tools": [
          "cge.pl",
          "cisco-ocs",
          "cisco-torch",
          "copy-router-config.pl",
          "merge-router-config.pl"
        ]
      },
      {
        "name": "Active Directory",
        "tools": [
          "azurehound",
          "bloodhound",
          "bloodhound-python",
          "bloodhound-ce-python",
          "ldeep",
          "sharphound"
        ]
      },
      {
        "name": "VoIP",
        "tools": [
          "protos-sip",
          "rtpbreak",
          "rtpinsertsound",
          "rtpmixsound",
          "siparmyknife",
          "sipp",
          "sippts",
          "sipsak",
          "svcrash",
          "svmap",
          "svreport",
          "svwar",
          "voiphopper",
          "ohrwurm"
        ]
      },
      {
        "name": "General / Featured",
        "tools": [
          "amass",
          "bloodhound",
          "masscan",
          "nmap",
          "zenmap",
          "wireshark",
          "tcpdump",
          "hping3",
          "arping",
          "fierce",
          "enum4linux",
          "netdiscover"
        ]
      }
    ]
  },
  {
    "name": "Lateral Movement",
    "summary": "Remote administration and movement tooling listed by Kali for controlled security testing.",
    "sections": [
      {
        "name": "Pass-the-Hash",
        "tools": [
          "crackmapexec",
          "evil-winrm",
          "evil-winrm-py",
          "impacket-scripts",
          "mimikatz",
          "netexec",
          "passing-the-hash",
          "rubeus",
          "smbmap",
          "xfreerdp3"
        ]
      },
      {
        "name": "General",
        "tools": [
          "crackmapexec",
          "evil-winrm",
          "impacket-smbexec",
          "impacket-psexec",
          "netexec",
          "xfreerdp3",
          "rdesktop"
        ]
      }
    ]
  },
  {
    "name": "Collection",
    "summary": "Traffic capture, web collection, interception and evidence-gathering utilities.",
    "sections": [
      {
        "name": "All tools",
        "tools": [
          "httrack",
          "ettercap-text-only",
          "ettercap",
          "evilginx2",
          "fiked",
          "fluxion",
          "mitmproxy",
          "mitm6",
          "ssldump",
          "sslsplit",
          "sslsniff",
          "wifipumpkin3",
          "ferret-sidejack",
          "hamster-sidejack",
          "copy-router-config.pl",
          "merge-router-config.pl"
        ]
      }
    ]
  },
  {
    "name": "Command and Control",
    "summary": "Protocol, tunnelling and remote-control tooling catalogued by Kali for authorised lab use.",
    "sections": [
      {
        "name": "Application Layer Protocol",
        "tools": [
          "cadaver",
          "crackmapexec",
          "evil-winrm",
          "impacket-scripts",
          "minicom",
          "netexec",
          "smbclient",
          "xfreerdp3"
        ]
      },
      {
        "name": "Non-Application Layer Protocol",
        "tools": [
          "dbd",
          "ncat",
          "netcat",
          "penelope",
          "powercat",
          "sbd",
          "socat",
          "termineter"
        ]
      },
      {
        "name": "Protocol Tunneling",
        "tools": [
          "chisel",
          "chisel-common-binaries",
          "dns2tcpc",
          "dns2tcpd",
          "dnscat",
          "iodine-client-start",
          "ligolo-agent",
          "ligolo-proxy",
          "ligolo-mp",
          "ligolo-mp-client",
          "ligolo-ng-common-binaries",
          "miredo",
          "proxychains4",
          "proxytunnel",
          "ptunnel",
          "pwnat",
          "sshuttle",
          "sslh",
          "stunnel4",
          "udptunnel"
        ]
      },
      {
        "name": "General",
        "tools": [
          "adaptixclient",
          "adaptixserver",
          "armitage",
          "havoc",
          "hoaxshell",
          "koadic",
          "metasploit-framework",
          "powershell-empire",
          "starkiller-start",
          "villain"
        ]
      }
    ]
  },
  {
    "name": "Exfiltration",
    "summary": "File-transfer and data-movement tools included in Kali's exfiltration category.",
    "sections": [
      {
        "name": "All tools",
        "tools": [
          "netcat",
          "impacket-smbserver",
          "goshs",
          "raven"
        ]
      }
    ]
  },
  {
    "name": "Impact",
    "summary": "Stress, availability and protocol-impact tools intended for isolated or explicitly authorised testing.",
    "sections": [
      {
        "name": "All tools",
        "tools": [
          "dhcpig",
          "goldeneye",
          "iaxflood",
          "inviteflood",
          "mdk3",
          "rtpflood",
          "siege",
          "slowhttptest",
          "t50",
          "thc-ssl-dos",
          "scapy"
        ]
      }
    ]
  },
  {
    "name": "Forensics",
    "summary": "Digital forensics, carving, imaging, PDF analysis and Sleuth Kit utilities.",
    "sections": [
      {
        "name": "Digital Forensics",
        "tools": [
          "dc3dd",
          "dcfldd",
          "hexwalk",
          "missidentify",
          "readpst",
          "reglookup",
          "regripper",
          "undbx",
          "vinetto"
        ]
      },
      {
        "name": "Forensic Carving Tools",
        "tools": [
          "ext3grep",
          "ext4magic",
          "extundelete",
          "foremost",
          "magicrescue",
          "myrescue",
          "pasco",
          "photorec",
          "readpe",
          "recoverdm",
          "recoverjpeg",
          "rifiuti",
          "rifiuti2",
          "safecopy",
          "scalpel",
          "scrounge-ntfs",
          "testdisk"
        ]
      },
      {
        "name": "Forensic Imaging Tools",
        "tools": [
          "affcat",
          "dc3dd",
          "dcfldd",
          "dd_rescue",
          "ewfacquire",
          "guymager"
        ]
      },
      {
        "name": "PDF Forensics Tools",
        "tools": [
          "pdfid",
          "pdf-parser"
        ]
      },
      {
        "name": "Sleuth Kit Suite",
        "tools": [
          "autopsy",
          "blkcalc",
          "blkcat",
          "blkls",
          "blkstat",
          "ffind",
          "fls",
          "fsstat",
          "grokevt-addlog",
          "grokevt-builddb",
          "grokevt-findlogs",
          "grokevt-parselog",
          "grokevt-ripdll",
          "hfind",
          "icat",
          "ifind",
          "ils",
          "img_cat",
          "img_stat",
          "istat",
          "jcat",
          "jls",
          "mactime",
          "mmcat",
          "mmls",
          "mmstat",
          "sigfind",
          "sorter",
          "srch_strings",
          "tsk_comparedir",
          "tsk_gettimes",
          "tsk_loaddb",
          "tsk_recover"
        ]
      },
      {
        "name": "General / Featured",
        "tools": [
          "autopsy",
          "binwalk",
          "binwalk3",
          "bulk_extractor",
          "chkrootkit",
          "foremost",
          "galleta",
          "hashdeep",
          "rkhunter",
          "ssdeep",
          "unhide",
          "xplico-webui-start",
          "yara"
        ]
      }
    ]
  },
  {
    "name": "Services and Other Tools",
    "summary": "Reporting, deliberately vulnerable labs, service launchers and general Kali utilities.",
    "sections": [
      {
        "name": "Reporting Tools",
        "tools": [
          "cherrytree",
          "dradis-start",
          "faraday-start",
          "maltego",
          "obsidian",
          "pipal",
          "recordmydesktop",
          "redeye-start",
          "cutycapt",
          "eyewitness",
          "witnessme"
        ]
      },
      {
        "name": "Laboratories",
        "tools": [
          "juice-shop-start",
          "dvwa-start"
        ]
      },
      {
        "name": "System Services",
        "tools": [
          "beef-xss-start",
          "beef-xss-stop",
          "defectdojo-start",
          "defectdojo-stop",
          "dradis-start",
          "dradis-stop",
          "dvwa-start",
          "dvwa-stop",
          "faraday-start",
          "faraday-stop",
          "gophish-start",
          "gophish-stop",
          "gvm-check-setup",
          "gvm-setup",
          "gvm-start",
          "gvm-stop",
          "juice-shop-start",
          "juice-shop-stop",
          "portspoof-start",
          "portspoof-stop",
          "redeye-start",
          "redeye-stop",
          "starkiller-start",
          "starkiller-stop",
          "thehive-start",
          "thehive-stop",
          "xplico-webui-start",
          "xplico-webui-stop"
        ]
      },
      {
        "name": "General",
        "tools": [
          "arsenal-ng",
          "code-oss",
          "gemini-cli",
          "hexstrike_server",
          "kali-tweaks",
          "pwsh",
          "root-terminal",
          "snapper-gui",
          "shell-gpt",
          "tailscale"
        ]
      }
    ]
  }
]

export const kaliToolEntryCount = kaliToolCategories.reduce(
  (total, category) =>
    total + category.sections.reduce((sectionTotal, section) => sectionTotal + section.tools.length, 0),
  0,
)

export const kaliUniqueToolCount = new Set(
  kaliToolCategories.flatMap((category) =>
    category.sections.flatMap((section) => section.tools),
  ),
).size
