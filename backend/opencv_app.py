from opencv_pipeline import parse_args, run


def main() -> None:
    config = parse_args()
    run(config)


if __name__ == "__main__":
    main()
