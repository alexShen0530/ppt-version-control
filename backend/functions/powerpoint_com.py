from threading import Lock


POWERPOINT_COM_LOCK = Lock()


if __name__ == "__main__":
    print("PowerPoint COM lock ready")
